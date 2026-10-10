import { Injectable, Logger } from '@nestjs/common';
import type { Symbol as SymbolRow, SymbolSession } from '@prisma/client';
import { isStale, type PriceBook, type Quote, type QuoteDto } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';

export type SymbolSpec = SymbolRow & { sessions: SymbolSession[] };

/**
 * Read side of pricing (ARCHITECTURE §08): symbol specs + sessions cached in memory, last prices from Redis `price:{S}`
 * written by the worker. The API never talks to a feed itself.
 */
@Injectable()
export class QuotesService {
  private readonly log = new Logger('Quotes');
  private symbols = new Map<string, SymbolSpec>();
  private loadedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** All enabled symbols with sessions; refreshed at most every 30s. */
  async specs(): Promise<Map<string, SymbolSpec>> {
    if (Date.now() - this.loadedAt > 30_000 || this.symbols.size === 0) {
      const rows = await this.prisma.symbol.findMany({ where: { enabled: true }, include: { sessions: true } });
      this.symbols = new Map(rows.map((r) => [r.id, r]));
      this.loadedAt = Date.now();
    }
    return this.symbols;
  }

  /** Back office changed an instrument: reload on the next read. */
  invalidate() {
    this.loadedAt = 0;
  }

  async spec(symbolId: string): Promise<SymbolSpec | undefined> {
    return (await this.specs()).get(symbolId);
  }

  /** Current prices for every enabled symbol (one Redis round trip). */
  async book(): Promise<PriceBook> {
    const ids = [...(await this.specs()).keys()];
    if (ids.length === 0) return {};
    const pipe = this.redis.client.pipeline();
    for (const id of ids) pipe.hgetall(`price:${id}`);
    const res = (await pipe.exec()) ?? [];
    const book: PriceBook = {};
    ids.forEach((id, i) => {
      const h = (res[i]?.[1] ?? {}) as Record<string, string>;
      if (h.bid && h.ask) book[id] = { bid: h.bid, ask: h.ask, ts: Number(h.ts) || 0 };
    });
    return book;
  }

  async quote(symbolId: string): Promise<Quote | undefined> {
    const h = await this.redis.client.hgetall(`price:${symbolId}`);
    return h.bid && h.ask ? { bid: h.bid, ask: h.ask, ts: Number(h.ts) || 0 } : undefined;
  }

  /** Trading window check from symbol_sessions (weekday 0 = Sunday, "HH:MM" UTC, "24:00" allowed). No rows = 24/7. */
  isOpen(spec: SymbolSpec, now = new Date()): boolean {
    if (!spec.isOpen) return false;
    if (spec.sessions.length === 0) return true;
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const day = now.getUTCDay();
    const toMin = (s: string) => {
      const [h, m] = s.split(':').map(Number);
      return h * 60 + m;
    };
    return spec.sessions.some((s) => s.weekday === day && minutes >= toMin(s.openTime) && minutes < toMin(s.closeTime));
  }

  async quoteDtos(symbolIds: string[]): Promise<QuoteDto[]> {
    const [specs, book] = await Promise.all([this.specs(), this.book()]);
    const now = Date.now();
    return symbolIds
      .filter((id) => specs.has(id))
      .map((id) => {
        const q = book[id];
        const spec = specs.get(id)!;
        return { s: id, bid: q?.bid ?? '', ask: q?.ask ?? '', ts: q?.ts ?? 0, stale: isStale(q, now), open: this.isOpen(spec) };
      });
  }
}
