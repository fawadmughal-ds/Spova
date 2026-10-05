import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger('Redis');
  readonly client: Redis;
  /** Dedicated connection for pub/sub subscribers (ioredis requires it). */
  readonly sub: Redis;

  constructor() {
    this.client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.sub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.client.on('error', (e) => this.log.error(`redis: ${e.message}`));
    this.sub.on('error', (e) => this.log.error(`redis-sub: ${e.message}`));
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.client.quit(), this.sub.quit()]);
  }

  /** Simple fixed-window rate limit. Returns true when allowed. */
  async allow(key: string, limit: number, windowSec: number): Promise<boolean> {
    const k = `rl:${key}`;
    const n = await this.client.incr(k);
    if (n === 1) await this.client.expire(k, windowSec);
    return n <= limit;
  }
}
