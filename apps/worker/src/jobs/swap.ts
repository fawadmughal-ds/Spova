import type { InternalClient } from '../internal-client';
import type { Logger } from '../logger';
import type { RedisClient } from '../redis';
import { daily, utcDate } from './scheduler';

/**
 * swap cron (ARCHITECTURE §10): POST /internal/trading/swap {date} at 00:00 UTC.
 * Idempotency key `swap:done:{date}` in Redis (the API is idempotent per date as well), so a boot after a
 * missed midnight runs today's accrual once.
 */
export class SwapJob {
  private stop?: () => void;
  constructor(
    private readonly api: InternalClient,
    private readonly redis: RedisClient,
    private readonly log: Logger,
  ) {}

  start() {
    this.stop = daily(0, 0, 30, () => this.runFor(utcDate()).then(() => undefined), (e) => this.log.error({ err: e }, 'swap cron failed'));
    void this.runFor(utcDate()).catch((e) => this.log.error({ err: e }, 'swap boot run failed'));
  }

  halt() {
    this.stop?.();
  }

  async runFor(date: string) {
    const key = `swap:done:${date}`;
    if (await this.redis.get(key)) {
      this.log.debug({ date }, 'swap already accrued');
      return false;
    }
    const res = await this.api.swap({ date });
    if (res.ok) {
      await this.redis.set(key, String(Date.now()), 'EX', 3 * 86_400);
      this.log.info({ date, result: res.body }, 'swap accrued');
      return true;
    }
    this.log.warn({ date, status: res.status }, 'swap call rejected');
    return false;
  }
}
