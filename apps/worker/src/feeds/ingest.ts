import Decimal from 'decimal.js';
import { dec, roundPrice, type PriceBook, type Quote } from '@spova/shared';
import type { WsTick } from '@spova/shared';
import type { Tick } from '../feed';
import type { Logger } from '../logger';
import { publishWs, type RedisClient } from '../redis';
import type { SymbolRegistry } from '../symbols';
import { Throttle } from './throttle';

export interface OurTick {
  symbol: string;
  quote: Quote;
  /** mid of our marked-up quote, rounded to symbol digits */
  mid: string;
  digits: number;
}

export type TickListener = (t: OurTick) => void;

/** Apply our spread markup around the venue quote and round to the symbol's digits. Pure; exported for tests. */
export function applyMarkup(raw: { bid: string; ask: string }, spreadMarkup: string, digits: number): { bid: string; ask: string; mid: string } {
  const half = dec(spreadMarkup).div(2);
  let bid = roundPrice(dec(raw.bid).minus(half), digits);
  let ask = roundPrice(dec(raw.ask).plus(half), digits);
  if (ask.lt(bid)) [bid, ask] = [ask, bid];
  const mid = roundPrice(bid.plus(ask).div(2), digits);
  return { bid: bid.toFixed(digits), ask: ask.toFixed(digits), mid: mid.toFixed(digits) };
}

/**
 * Normalises every feed tick: markup -> `price:{S}` hash (always) -> `tick` WS event (<= 4/s per symbol) -> listeners
 * (candles, risk). Also keeps the in-memory price book the risk engine converts currencies with.
 */
export class Ingest {
  readonly book: PriceBook = {};
  private lastTickAt = new Map<string, number>();
  private listeners: TickListener[] = [];
  private readonly wsThrottle: Throttle<WsTick>;
  private stats = { raw: 0, dropped: 0 };

  constructor(
    private readonly redis: RedisClient,
    private readonly symbols: SymbolRegistry,
    private readonly log: Logger,
    maxEmitPerSec = 4,
  ) {
    this.wsThrottle = new Throttle<WsTick>(Math.floor(1000 / maxEmitPerSec), (symbol, payload) => {
      void publishWs(this.redis, `symbol:${symbol}`, 'tick', payload).catch((e) => this.log.warn({ err: e }, 'tick publish failed'));
    });
  }

  onTick(fn: TickListener) {
    this.listeners.push(fn);
  }

  /** Seed the book from Redis so closed-market symbols still have a price for conversions / floating P/L. */
  async loadBookFromRedis() {
    const ids = this.symbols.all().map((s) => s.id);
    if (ids.length === 0) return;
    const pipe = this.redis.pipeline();
    for (const id of ids) pipe.hgetall(`price:${id}`);
    const res = (await pipe.exec()) ?? [];
    let n = 0;
    res.forEach((r, i) => {
      const h = (r?.[1] ?? {}) as Record<string, string>;
      if (h.bid && h.ask && h.ts) {
        this.book[ids[i]!] = { bid: h.bid, ask: h.ask, ts: Number(h.ts) };
        this.lastTickAt.set(ids[i]!, Number(h.ts));
        n++;
      }
    });
    this.log.info({ quotes: n }, 'price book seeded from redis');
  }

  lastTick(symbol: string): number | undefined {
    return this.lastTickAt.get(symbol);
  }

  counters() {
    return { ...this.stats };
  }

  handle(raw: Tick) {
    this.stats.raw++;
    const meta = this.symbols.get(raw.symbol);
    if (!meta || !meta.enabled) {
      this.stats.dropped++;
      return;
    }
    if (!Number.isFinite(Number(raw.bid)) || !Number.isFinite(Number(raw.ask)) || Number(raw.bid) <= 0) {
      this.stats.dropped++;
      return;
    }
    const { bid, ask, mid } = applyMarkup(raw, meta.spreadMarkup, meta.digits);
    const quote: Quote = { bid, ask, ts: raw.ts };
    this.book[raw.symbol] = quote;
    this.lastTickAt.set(raw.symbol, raw.ts);

    void this.redis.hset(`price:${raw.symbol}`, { bid, ask, ts: String(raw.ts) }).catch((e) => this.log.warn({ err: e }, 'price hset failed'));
    this.wsThrottle.push(raw.symbol, { s: raw.symbol, bid, ask, ts: raw.ts });

    const our: OurTick = { symbol: raw.symbol, quote, mid, digits: meta.digits };
    for (const l of this.listeners) {
      try {
        l(our);
      } catch (e) {
        this.log.error({ err: e, symbol: raw.symbol }, 'tick listener threw');
      }
    }
  }

  flush() {
    this.wsThrottle.flushAll();
  }
}

export const midOf = (q: Quote): Decimal => dec(q.bid).plus(q.ask).div(2);
