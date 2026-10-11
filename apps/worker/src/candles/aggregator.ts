import { bucketEnd, bucketStart, TIMEFRAMES, type Timeframe } from '@spova/shared';

export interface Bar {
  s: string;
  tf: Timeframe;
  /** bucket start, unix seconds */
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  /** tick count */
  v: number;
}

export interface UpdateResult {
  /** bars (one per tf) in their state after this tick */
  live: Bar[];
  /** bars that rolled over because this tick belongs to a newer bucket */
  closed: Bar[];
}

const key = (s: string, tf: Timeframe) => `${s}:${tf}`;

/**
 * In-memory OHLC aggregation of mid prices per symbol and timeframe. Pure (no I/O):
 * `update` on every tick, `closeExpired` on a timer so a bar still closes when ticks stop (market closed).
 * Late ticks (older than the current bucket) are ignored.
 */
export class CandleAggregator {
  private bars = new Map<string, Bar>();

  constructor(private readonly tfs: readonly Timeframe[] = TIMEFRAMES) {}

  update(symbol: string, price: string, tsMs: number): UpdateResult {
    const live: Bar[] = [];
    const closed: Bar[] = [];
    const p = Number(price);
    for (const tf of this.tfs) {
      const t = bucketStart(tsMs, tf);
      const k = key(symbol, tf);
      let bar = this.bars.get(k);
      if (!bar || t > bar.t) {
        if (bar) closed.push(bar);
        bar = { s: symbol, tf, t, o: price, h: price, l: price, c: price, v: 1 };
        this.bars.set(k, bar);
      } else if (t === bar.t) {
        if (p > Number(bar.h)) bar.h = price;
        if (p < Number(bar.l)) bar.l = price;
        bar.c = price;
        bar.v++;
      } else {
        continue; // late tick
      }
      live.push(bar);
    }
    return { live, closed };
  }

  /** Close every bar whose bucket ended before `nowMs` (no tick arrived to roll it). */
  closeExpired(nowMs: number): Bar[] {
    const out: Bar[] = [];
    for (const [k, bar] of this.bars) {
      if (bucketEnd(bar.t, bar.tf) <= Math.floor(nowMs / 1000)) {
        out.push(bar);
        this.bars.delete(k);
      }
    }
    return out;
  }

  get(symbol: string, tf: Timeframe): Bar | undefined {
    return this.bars.get(key(symbol, tf));
  }

  /** Every open bar (used on shutdown to persist partial state as closed bars is NOT done; live hashes only). */
  all(): Bar[] {
    return [...this.bars.values()];
  }
}
