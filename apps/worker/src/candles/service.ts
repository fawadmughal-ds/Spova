import { Prisma } from '@prisma/client';
import { TIMEFRAMES, type Timeframe, type WsCandle } from '@spova/shared';
import type { Db } from '../db';
import type { OurTick } from '../feeds/ingest';
import { Throttle } from '../feeds/throttle';
import type { Logger } from '../logger';
import { publishWs, type RedisClient } from '../redis';
import { CandleAggregator, type Bar } from './aggregator';

const toWs = (b: Bar, closed: boolean): WsCandle => ({ s: b.s, tf: b.tf, t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, closed });

/** Multi-row upsert into `candles`. Exported so the backfill reuses it. */
export async function upsertCandles(db: Db, bars: Bar[]) {
  if (bars.length === 0) return;
  const rows = bars.map(
    (b) => Prisma.sql`(${b.s}, ${b.tf}::"Timeframe", to_timestamp(${b.t}), ${b.o}::numeric, ${b.h}::numeric, ${b.l}::numeric, ${b.c}::numeric, ${b.v})`,
  );
  await db.$executeRaw`
    INSERT INTO candles (symbol_id, tf, t, o, h, l, c, v)
    VALUES ${Prisma.join(rows)}
    ON CONFLICT (symbol_id, tf, t) DO UPDATE
      SET o = EXCLUDED.o, h = EXCLUDED.h, l = EXCLUDED.l, c = EXCLUDED.c, v = EXCLUDED.v`;
}

/**
 * Wires the aggregator to Redis + Postgres:
 *  - on tick: `candle:live:{S}:{tf}` for every tf (throttled with the m1 WS `candle` event, <= 2/s per symbol)
 *  - on bar close: `candle` with closed:true per tf and a batched upsert into `candles`
 */
export class CandleService {
  readonly agg = new CandleAggregator(TIMEFRAMES);
  private pendingClosed: Bar[] = [];
  private flushTimer?: NodeJS.Timeout;
  private rollTimer?: NodeJS.Timeout;
  private readonly liveThrottle: Throttle<Bar[]>;
  private writes = { bars: 0, batches: 0, failures: 0 };

  constructor(
    private readonly db: Db,
    private readonly redis: RedisClient,
    private readonly log: Logger,
    private readonly opts = { liveEmitPerSec: 2, flushMs: 2000, flushBatch: 500 },
  ) {
    this.liveThrottle = new Throttle<Bar[]>(Math.floor(1000 / opts.liveEmitPerSec), (_symbol, bars) => this.writeLive(bars));
  }

  start() {
    this.flushTimer = setInterval(() => void this.flush(), this.opts.flushMs);
    this.rollTimer = setInterval(() => this.rollIdle(), 1000);
    this.flushTimer.unref();
    this.rollTimer.unref();
  }

  async stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.rollTimer) clearInterval(this.rollTimer);
    this.liveThrottle.flushAll();
    await this.flush();
  }

  stats() {
    return { ...this.writes, pending: this.pendingClosed.length };
  }

  onTick = (t: OurTick) => {
    const { live, closed } = this.agg.update(t.symbol, t.mid, t.quote.ts);
    if (closed.length) this.onClosed(closed);
    this.liveThrottle.push(t.symbol, live);
  };

  private rollIdle() {
    const closed = this.agg.closeExpired(Date.now());
    if (closed.length) this.onClosed(closed);
  }

  private onClosed(bars: Bar[]) {
    this.pendingClosed.push(...bars);
    for (const b of bars) {
      void publishWs(this.redis, `symbol:${b.s}`, 'candle', toWs(b, true)).catch((e) => this.log.warn({ err: e }, 'candle publish failed'));
    }
    if (this.pendingClosed.length >= this.opts.flushBatch) void this.flush();
  }

  private writeLive(bars: Bar[]) {
    const pipe = this.redis.pipeline();
    for (const b of bars) pipe.hset(`candle:live:${b.s}:${b.tf}`, { t: String(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: String(b.v) });
    const m1 = bars.find((b) => b.tf === 'm1');
    if (m1) pipe.publish('ws:events', JSON.stringify({ room: `symbol:${m1.s}`, event: 'candle', payload: toWs(m1, false) }));
    void pipe.exec().catch((e) => this.log.warn({ err: e }, 'candle live write failed'));
  }

  async flush() {
    if (this.pendingClosed.length === 0) return;
    const batch = this.pendingClosed.splice(0, this.pendingClosed.length);
    try {
      await upsertCandles(this.db, batch);
      this.writes.bars += batch.length;
      this.writes.batches++;
      this.log.debug({ bars: batch.length }, 'candles flushed');
    } catch (e) {
      this.writes.failures++;
      this.log.error({ err: e, bars: batch.length }, 'candle flush failed, re-queueing');
      this.pendingClosed.unshift(...batch.slice(0, 5000)); // cap so a dead DB cannot grow memory forever
    }
  }

  /** Live bar as currently aggregated (for diagnostics). */
  live(symbol: string, tf: Timeframe) {
    return this.agg.get(symbol, tf);
  }
}
