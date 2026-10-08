import type { Logger } from '../logger';
import type { RedisClient } from '../redis';

export function startHeartbeat(redis: RedisClient, log: Logger, intervalMs = 10_000) {
  const beat = () => void redis.set('worker:heartbeat', String(Date.now()), 'EX', 30).catch((e) => log.warn({ err: e }, 'heartbeat failed'));
  beat();
  const t = setInterval(beat, intervalMs);
  t.unref();
  return () => clearInterval(t);
}
