import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { ASSET_CLASSES } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { Public } from '../../common/auth/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ApiError } from '../../common/errors';

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

  @Get('risk-config')
  riskConfig() {
    return this.prisma.riskConfig.findMany({ orderBy: { minDeposit: 'asc' } });
  }
}
