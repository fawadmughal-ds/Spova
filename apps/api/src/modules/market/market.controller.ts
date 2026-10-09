import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { ASSET_CLASSES, type CalendarEventDto } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { Public } from '../../common/auth/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApiError } from '../../common/errors';

/** Public weekly economic calendar (ForexFactory's open JSON feed), cached in Redis for 15 minutes. */
const CALENDAR_URLS = ['https://nfs.faireconomy.media/ff_calendar_thisweek.json', 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'];
const CALENDAR_KEY = 'calendar:thisweek';
const CALENDAR_TTL = 15 * 60;
const CURRENCY_COUNTRY: Record<string, string> = { USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU', NZD: 'NZ', CAD: 'CA', CHF: 'CH', CNY: 'CN', INR: 'IN', All: 'WW' };
const IMPACT: Record<string, CalendarEventDto['impact']> = { High: 3, Medium: 2, Low: 1, Holiday: 0 };
interface FfEvent { title: string; country: string; date: string; impact: string; forecast?: string; previous?: string; actual?: string }

const symbolsQuery = z.object({
  class: z.enum(ASSET_CLASSES).optional(),
  featured: z.coerce.boolean().optional(),
});

@Controller('market')
@Public()
export class MarketController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('symbols')
  async symbols(@Query(new ZodPipe(symbolsQuery)) q: z.infer<typeof symbolsQuery>) {
    const rows = await this.prisma.symbol.findMany({
      where: { enabled: true, ...(q.class && { assetClass: q.class }), ...(q.featured && { featured: true }) },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    // Last quotes from Redis (worker fills these in Phase 3; empty until then).
    const pipe = this.redis.client.pipeline();
    for (const s of rows) pipe.hgetall(`price:${s.id}`);
    const quotes = (await pipe.exec()) ?? [];
    return rows.map((s, i) => {
      const qv = (quotes[i]?.[1] ?? {}) as Record<string, string>;
      return {
        id: s.id,
        name: s.name,
        assetClass: s.assetClass,
        digits: s.digits,
        contractSize: s.contractSize.toString(),
        minLot: s.minLot.toString(),
        maxLot: s.maxLot.toString(),
        lotStep: s.lotStep.toString(),
        leverageMax: s.leverageMax,
        spreadMarkup: s.spreadMarkup.toString(),
        swapLong: s.swapLong.toString(),
        swapShort: s.swapShort.toString(),
        isOpen: s.isOpen,
        featured: s.featured,
        quote: qv.bid ? { bid: qv.bid, ask: qv.ask, ts: Number(qv.ts) } : null,
      };
    });
  }

  @Get('symbols/:id')
  async symbol(@Param('id') id: string) {
    const s = await this.prisma.symbol.findUnique({ where: { id }, include: { sessions: true } });
    if (!s || !s.enabled) throw ApiError.notFound('symbol_not_found', 'Symbol not found');
    return s;
  }

  /** Weekly trading hours (UTC) for every enabled symbol. No rows for a symbol = open 24/7. */
  @Get('sessions')
  sessions() {
    return this.prisma.symbolSession.findMany({
      where: { symbol: { enabled: true } },
      select: { symbolId: true, weekday: true, openTime: true, closeTime: true },
      orderBy: [{ symbolId: 'asc' }, { weekday: 'asc' }, { openTime: 'asc' }],
    });
  }

  /** Upcoming full-day closures per symbol (today onwards). */
  @Get('calendar')
  async calendar(): Promise<CalendarEventDto[]> {
    const cached = await this.redis.client.get(CALENDAR_KEY);
    if (cached) return JSON.parse(cached) as CalendarEventDto[];
    let raw: FfEvent[] = [];
    try {
      // this week + next week, so the list is never empty on a weekend
      const pages = await Promise.all(CALENDAR_URLS.map((u) => fetch(u, { signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'spova-terminal/1.0' } }).then((r) => (r.ok ? (r.json() as Promise<FfEvent[]>) : []))));
      raw = pages.flat();
      if (raw.length === 0) throw new Error('empty');
    } catch {
      /* feed down: serve whatever is cached, else empty */
      const stale = await this.redis.client.get(`${CALENDAR_KEY}:stale`);
      if (stale) return JSON.parse(stale) as CalendarEventDto[];
      return [];
    }
    const events: CalendarEventDto[] = raw
      .filter((e) => e && e.title && e.date)
      .map((e, i) => ({
        id: `${e.date}-${e.country}-${i}`,
        country: CURRENCY_COUNTRY[e.country] ?? e.country.slice(0, 2).toUpperCase(),
        currency: e.country === 'All' ? '' : e.country,
        at: new Date(e.date).toISOString(),
        title: e.title,
        impact: IMPACT[e.impact] ?? 1,
        previous: e.previous || null,
        forecast: e.forecast || null,
        actual: e.actual || null,
      }))
      .sort((a, b) => a.at.localeCompare(b.at));
    const json = JSON.stringify(events);
    await this.redis.client.set(CALENDAR_KEY, json, 'EX', CALENDAR_TTL);
    await this.redis.client.set(`${CALENDAR_KEY}:stale`, json, 'EX', 7 * 24 * 3600);
    return events;
  }

  @Get('holidays')
  async holidays() {
    const today = new Date(new Date().toISOString().slice(0, 10));
    const rows = await this.prisma.symbolHoliday.findMany({
      where: { date: { gte: today }, symbol: { enabled: true } },
      orderBy: [{ date: 'asc' }, { symbolId: 'asc' }],
    });
    return rows.map((r) => ({ symbolId: r.symbolId, date: r.date.toISOString().slice(0, 10) }));
  }

  /**
   * Market sentiment = share of open volume that is long vs short per symbol across the whole book
   * (our own clients, not an external feed). Symbols without open positions are omitted.
   */
  @Get('sentiment')
  async sentiment(@Query('symbols') symbols?: string) {
    const ids = (symbols ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    const rows = await this.prisma.position.groupBy({
      by: ['symbolId', 'side'],
      where: { status: 'open', ...(ids.length && { symbolId: { in: ids } }) },
      _sum: { lots: true },
    });
    const bySymbol = new Map<string, { buy: number; sell: number }>();
    for (const r of rows) {
      const e = bySymbol.get(r.symbolId) ?? { buy: 0, sell: 0 };
      e[r.side] += Number(r._sum.lots ?? 0);
      bySymbol.set(r.symbolId, e);
    }
    return [...bySymbol.entries()].map(([s, v]) => {
      const total = v.buy + v.sell;
      return { s, buyPct: total ? Math.round((v.buy / total) * 100) : 50, sellPct: total ? 100 - Math.round((v.buy / total) * 100) : 50, lots: total.toFixed(2) };
    });
  }

  @Get('risk-config')
  riskConfig() {
    return this.prisma.riskConfig.findMany({ orderBy: { minDeposit: 'asc' } });
  }
}
