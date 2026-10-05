import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Redis from 'ioredis';
import pino from 'pino';
import type { Tick } from './feed';

for (const c of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(c)) {
    loadDotenv({ path: c });
    break;
  }
}

const log = pino({ level: process.env.LOG_LEVEL ?? 'info', transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' } });
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

/**
 * Worker skeleton (Phase 0). Phase 3 adds:
 *  - price-ingest: FeedAdapter[] -> publishTick
 *  - candles: tick aggregation -> candles table
 *  - risk-engine: floating pnl, SL/TP, margin call, stop-out via per-account queue
 *  - pending-orders, swap cron, mail, statement-pdf
 * Exactly one instance runs in production.
 */
async function publishTick(t: Tick) {
  await redis.hset(`price:${t.symbol}`, { bid: t.bid, ask: t.ask, ts: String(t.ts) });
  await redis.publish('ws:events', JSON.stringify({ room: `symbol:${t.symbol}`, event: 'tick', payload: { s: t.symbol, bid: t.bid, ask: t.ask, ts: t.ts } }));
}

async function main() {
  log.info('worker up (phase 0 skeleton) - no feeds enabled');
  // heartbeat so ops can see it alive
  setInterval(() => void redis.set('worker:heartbeat', String(Date.now()), 'EX', 30), 10_000);
  void publishTick; // referenced for Phase 3
}

main().catch((e) => {
  log.error(e);
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log.info(`${sig} received, shutting down`);
    void redis.quit().finally(() => process.exit(0));
  });
}
