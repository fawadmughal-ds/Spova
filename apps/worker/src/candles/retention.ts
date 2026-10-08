import type { Db } from '../db';
import type { Logger } from '../logger';

/** candles:retention (ARCHITECTURE §10): m1 older than 7 days, m5 older than 30 days. */
export async function runCandleRetention(db: Db, log: Logger) {
  const m1 = await db.candle.deleteMany({ where: { tf: 'm1', t: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  const m5 = await db.candle.deleteMany({ where: { tf: 'm5', t: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  log.info({ m1: m1.count, m5: m5.count }, 'candle retention done');
  return { m1: m1.count, m5: m5.count };
}
