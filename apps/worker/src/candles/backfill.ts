import { bucketStart, TIMEFRAMES, TF_LABEL, TF_SECONDS, type Timeframe } from '@spova/shared';
import type { Db } from '../db';
import { ANNUAL_VOL, gaussian, stepPrice, SYNTHETIC_BASE } from '../feeds/synthetic';
import type { Logger } from '../logger';
import type { SymbolRegistry } from '../symbols';
import type { Bar } from './aggregator';
import { upsertCandles } from './service';

const BINANCE_REST = 'https://api.binance.com/api/v3/klines';
const BINANCE_PAGE = 1000; // hard max per request

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];

export interface BackfillOptions {
  minBars: number;
  bars: number;
  /** current mid per symbol (synthetic history ends here) */
  currentPrice: (symbol: string) => number | undefined;
  fetchImpl?: typeof fetch;
  rng?: () => number;
}

/**
 * Boot-time history. A (symbol, tf) with fewer than `minBars` closed bars gets `bars` of history:
 *  - binance symbols: REST klines (paginated backwards, 1000 per call)
 *  - synthetic symbols: a mean-reverting random walk generated backwards from the current price,
 *    skipping buckets outside the trading session. These are demo instruments; the history is plausible, not real.
 */
export class CandleBackfill {
  constructor(
    private readonly db: Db,
    private readonly symbols: SymbolRegistry,
    private readonly log: Logger,
    private readonly opts: BackfillOptions,
  ) {}

  async run() {
    const counts = await this.db.candle.groupBy({ by: ['symbolId', 'tf'], _count: { _all: true } });
    const have = new Map(counts.map((c) => [`${c.symbolId}:${c.tf}`, c._count._all]));
    let filled = 0;
    for (const s of this.symbols.enabled()) {
      for (const tf of TIMEFRAMES) {
        const n = have.get(`${s.id}:${tf}`) ?? 0;
        if (n >= this.opts.minBars) continue;
        try {
          const bars = s.feedSource === 'binance' ? await this.fromBinance(s.feedSymbol, s.id, tf) : this.synthetic(s.id, s.assetClass, s.digits, tf);
          for (let i = 0; i < bars.length; i += 500) await upsertCandles(this.db, bars.slice(i, i + 500));
          filled += bars.length;
          this.log.info({ symbol: s.id, tf, had: n, bars: bars.length, source: s.feedSource }, 'candles backfilled');
        } catch (e) {
          this.log.warn({ err: e, symbol: s.id, tf }, 'backfill failed');
        }
      }
    }
    return filled;
  }

  async fromBinance(feedSymbol: string, symbol: string, tf: Timeframe): Promise<Bar[]> {
    const f = this.opts.fetchImpl ?? fetch;
    const out: Bar[] = [];
    let endTime: number | undefined;
    let remaining = this.opts.bars;
    const nowBucket = bucketStart(Date.now(), tf);
    while (remaining > 0) {
      const limit = Math.min(BINANCE_PAGE, remaining);
      const url = new URL(BINANCE_REST);
      url.searchParams.set('symbol', feedSymbol.toUpperCase());
      url.searchParams.set('interval', TF_LABEL[tf]);
      url.searchParams.set('limit', String(limit));
      if (endTime) url.searchParams.set('endTime', String(endTime));
      const res = await f(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`binance klines ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const rows = (await res.json()) as Kline[];
      if (rows.length === 0) break;
      for (const k of rows) {
        const t = Math.floor(k[0] / 1000);
        if (t >= nowBucket) continue; // the live aggregator owns the current bucket
        out.push({ s: symbol, tf, t, o: k[1], h: k[2], l: k[3], c: k[4], v: k[8] });
      }
      remaining -= rows.length;
      endTime = rows[0]![0] - 1;
      if (rows.length < limit) break;
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  synthetic(symbol: string, assetClass: string, digits: number, tf: Timeframe): Bar[] {
    const rng = this.opts.rng ?? Math.random;
    const current = this.opts.currentPrice(symbol) ?? SYNTHETIC_BASE[symbol] ?? 100;
    const anchor = SYNTHETIC_BASE[symbol] ?? current;
    const secs = TF_SECONDS[tf];
    const annualVol = ANNUAL_VOL[assetClass] ?? 0.2;
    // half-life grows with the timeframe (>= 30 bars) so d1 history is not pinned to the anchor
    const halfLifeSec = Math.max(6 * 3600, 30 * secs);
    const sigma = annualVol * Math.sqrt(secs / (365 * 24 * 3600));

    // 1) collect the open buckets going back from the last closed bucket
    const times: number[] = [];
    let t = bucketStart(Date.now(), tf) - secs;
    let scanned = 0;
    while (times.length < this.opts.bars && scanned < this.opts.bars * 8) {
      scanned++;
      if (this.symbols.isOpen(symbol, new Date(t * 1000))) times.push(t);
      t -= secs;
    }
    times.reverse();

    // 2) run the mean-reverting walk FORWARDS (a reversed OU process is explosive), then
    // 3) rescale multiplicatively so the last close is exactly the current price
    const closes: number[] = [];
    let price = anchor * Math.exp(sigma * gaussian(rng) * 3);
    for (let i = 0; i < times.length; i++) {
      price = stepPrice({ price, anchor, annualVol, dtSec: secs, halfLifeSec }, rng);
      closes.push(price);
    }
    const scale = closes.length ? current / closes[closes.length - 1]! : 1;
    const fmt = (v: number) => (v * scale).toFixed(digits);
    const bars: Bar[] = [];
    for (let i = 0; i < times.length; i++) {
      const open = i === 0 ? closes[0]! * Math.exp(sigma * gaussian(rng)) : closes[i - 1]!;
      const close = closes[i]!;
      const wick = Math.abs(sigma * gaussian(rng)) * 0.6;
      const hi = Math.max(open, close) * (1 + wick);
      const lo = Math.min(open, close) * (1 - wick);
      bars.push({ s: symbol, tf, t: times[i]!, o: fmt(open), h: fmt(hi), l: fmt(lo), c: fmt(close), v: Math.max(1, Math.round(secs / 2 + (gaussian(rng) * secs) / 8)) });
    }
    return bars;
  }
}
