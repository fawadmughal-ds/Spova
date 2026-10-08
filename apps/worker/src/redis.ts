import Redis from 'ioredis';

export type RedisClient = Redis;

export function createRedis(url: string, opts: { subscriber?: boolean } = {}): Redis {
  return new Redis(url, {
    lazyConnect: false,
    maxRetriesPerRequest: opts.subscriber ? null : 3,
    enableAutoPipelining: !opts.subscriber,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
}

/** Publish a {room,event,payload} envelope on ws:events (relayed by the API gateway). */
export function publishWs(redis: Redis, room: string, event: string, payload: unknown) {
  return redis.publish('ws:events', JSON.stringify({ room, event, payload }));
}
