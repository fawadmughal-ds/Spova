import { bucketShift, bucketStart, TIMEFRAMES, TF_LABEL, TF_SECONDS, type Timeframe } from '@spova/shared';
import type { Db } from '../db';
import { ANNUAL_VOL, gaussian, stepPrice, SYNTHETIC_BASE } from '../feeds/synthetic';
import type { Logger } from '../logger';
import type { SymbolRegistry } from '../symbols';
import type { Bar } from './aggregator';
import { upsertCandles } from './service';

const BINANCE_REST = 'https://api.binance.com/api/v3/klines';
const BINANCE_PAGE = 1000; // hard max per request
const OANDA_PAGE = 5000; // hard max per request
/** our timeframe -> OANDA granularity */
export const OANDA_GRANULARITY: Record<Timeframe, string> = { m1: 'M1', m5: 'M5', m15: 'M15', m30: 'M30', h1: 'H1', h4: 'H4', d1: 'D', w1: 'W', mn1: 'M' };

interface OandaCandle {
  time: string;
  complete: boolean;
  volume: number;
  mid: { o: string; h: string; l: string; c: string };
}

export interface OandaHistory {
  token: string;
  accountId: string;
  env: 'practice' | 'live';
  /** our symbol id -> OANDA instrument, only for the symbols the live feed took over */
  instruments: Record<string, string>;
}

/** OANDA candle JSON -> our bars (closed candles only, aligned to UTC buckets). */
export function parseOandaCandles(symbol: string, tf: Timeframe, candles: OandaCandle[], nowBucket: number): Bar[] {
  const out: Bar[] = [];
  for (const c of candles) {
    if (!c.complete || !c.mid) continue;
    const t = bucketStart(Date.parse(c.time), tf);
    if (!Number.isFinite(t) || t >= nowBucket) continue;
    out.push({ s: symbol, tf, t, o: c.mid.o, h: c.mid.h, l: c.mid.l, c: c.mid.c, v: c.volume ?? 0 });
  }
  return out;
}

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];

export interface BackfillOptions {
  minBars: number;
  bars: number;
  /** current mid per symbol (synthetic history ends here) */
  currentPrice: (symbol: string) => number | undefined;
  fetchImpl?: typeof fetch;
  rng?: () => number;
  /** when set, these symbols get real OANDA history instead of synthetic bars */
  oanda?: OandaHistory;
}

/**
 * Boot-time history. A (symbol, tf) with fewer than `minBars` closed bars gets `bars` of history:
 *  - binance symbols: REST klines (paginated backwards, 1000 per call)
 *  - OANDA-fed symbols: v3 instrument candles (mid prices, UTC-aligned, paginated backwards, 5000 per call)
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
          const oandaInstrument = this.opts.oanda?.instruments[s.id];
          const source = s.feedSource === 'binance' ? 'binance' : oandaInstrument ? 'oanda' : 'synthetic';
          const bars = source === 'binance' ? await this.fromBinance(s.feedSymbol, s.id, tf) : source === 'oanda' ? await this.fromOanda(oandaInstrument!, s.id, tf) : this.synthetic(s.id, s.assetClass, s.digits, tf);
          for (let i = 0; i < bars.length; i += 500) await upsertCandles(this.db, bars.slice(i, i + 500));
          filled += bars.length;
          this.log.info({ symbol: s.id, tf, had: n, bars: bars.length, source }, 'candles backfilled');
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

  async fromOanda(instrument: string, symbol: string, tf: Timeframe): Promise<Bar[]> {
    const o = this.opts.oanda!;
    const f = this.opts.fetchImpl ?? fetch;
    const host = o.env === 'live' ? 'api-fxtrade.oanda.com' : 'api-fxpractice.oanda.com';
    const out: Bar[] = [];
    const nowBucket = bucketStart(Date.now(), tf);
    let remaining = this.opts.bars;
    let to: string | undefined;
    while (remaining > 0) {
      const count = Math.min(OANDA_PAGE, remaining);
      const url = new URL(`https://${host}/v3/instruments/${encodeURIComponent(instrument)}/candles`);
      url.searchParams.set('granularity', OANDA_GRANULARITY[tf]);
      url.searchParams.set('price', 'M');
      url.searchParams.set('count', String(count));
      url.searchParams.set('alignmentTimezone', 'UTC');
      url.searchParams.set('dailyAlignment', '0');
      if (to) url.searchParams.set('to', to);
      const res = await f(url, { signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${o.token}`, 'Accept-Datetime-Format': 'RFC3339' } });
      if (!res.ok) throw new Error(`oanda candles ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { candles?: OandaCandle[] };
      const rows = body.candles ?? [];
      if (rows.length === 0) break;
      out.push(...parseOandaCandles(symbol, tf, rows, nowBucket));
      remaining -= rows.length;
      to = rows[0]!.time;
      if (rows.length < count) break;
    }
    const seen = new Set<number>();
    return out.filter((b) => !seen.has(b.t) && seen.add(b.t)).sort((a, b) => a.t - b.t);
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
    // (weekly/monthly buckets always contain an open session, so they are never skipped)
    const times: number[] = [];
    const calendar = tf === 'w1' || tf === 'mn1';
    let t = bucketShift(bucketStart(Date.now(), tf), tf, -1);
    let scanned = 0;
    while (times.length < this.opts.bars && scanned < this.opts.bars * 8) {
      scanned++;
      if (calendar || this.symbols.isOpen(symbol, new Date(t * 1000))) times.push(t);
      t = bucketShift(t, tf, -1);
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
