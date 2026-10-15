import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  candlesQuerySchema,
  closePositionSchema,
  internalCloseSchema,
  internalFillSchema,
  internalMarginCallSchema,
  internalStopOutSchema,
  internalSwapSchema,
  modifyPositionSchema,
  paginationSchema,
  placeOrderSchema,
  type CandleDto,
  type ClosePositionInput,
  type ModifyPositionInput,
  type PlaceOrderInput,
} from '@spova/shared';
import { TradingService } from './trading.service';
import { QuotesService } from '../quotes/quotes.service';
import { InternalGuard } from './internal.guard';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { ClientIp, CurrentUser, Public, Roles } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { ZodPipe } from '../../common/pipes/zod.pipe';

const posQuery = z.object({ status: z.enum(['open', 'closed']).default('open') });
const ordQuery = z.object({ status: z.enum(['pending', 'filled', 'cancelled', 'rejected', 'expired']).optional() });

@Controller('me/accounts/:id')
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Get('positions')
  positions(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query(new ZodPipe(posQuery)) q: z.infer<typeof posQuery>) {
    return this.trading.guardedAccount(id, { id: user.id }, { readOnly: true }).then(() => this.trading.livePositions(id, q.status));
  }

  @Get('orders')
  async orders(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query(new ZodPipe(ordQuery)) q: z.infer<typeof ordQuery>) {
    await this.trading.guardedAccount(id, { id: user.id }, { readOnly: true });
    return this.trading.listOrders(id, q.status);
  }

  @Post('orders')
  place(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(placeOrderSchema)) body: PlaceOrderInput) {
    return this.trading.placeOrder(id, body, { id: user.id, ip });
  }

  @Delete('orders/:oid')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('oid') oid: string) {
    return this.trading.cancelOrder(id, oid, { id: user.id });
  }

  @Patch('positions/:pid')
  modify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pid') pid: string, @Body(new ZodPipe(modifyPositionSchema)) body: ModifyPositionInput) {
    return this.trading.modifyPosition(id, pid, body, { id: user.id });
  }

  @Post('positions/:pid/close')
  close(@CurrentUser() user: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Param('pid') pid: string, @Body(new ZodPipe(closePositionSchema)) body: ClosePositionInput) {
    return this.trading.closeByUser(id, pid, body.lots, { id: user.id, ip });
  }
}

@Controller('market')
@Public()
export class MarketDataController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly quotes: QuotesService,
  ) {}

  /** Closed bars from Postgres plus the live bar from Redis (`candle:live:{S}:{tf}`), oldest first. */
  @Get('candles/:symbol')
  async candles(@Param('symbol') symbol: string, @Query(new ZodPipe(candlesQuerySchema)) q: z.infer<typeof candlesQuerySchema>): Promise<CandleDto[]> {
    const rows = await this.prisma.candle.findMany({
      where: { symbolId: symbol, tf: q.tf, ...(q.from && { t: { gte: new Date(q.from * 1000) } }), ...(q.to && { t: { lte: new Date(q.to * 1000) } }) },
      orderBy: { t: 'desc' },
      take: q.limit,
    });
    const out: CandleDto[] = rows.reverse().map((c) => ({ t: Math.floor(c.t.getTime() / 1000), o: c.o.toString(), h: c.h.toString(), l: c.l.toString(), c: c.c.toString(), v: c.v ?? undefined }));
    if (!q.to) {
      const live = await this.redis.client.hgetall(`candle:live:${symbol}:${q.tf}`);
      if (live.t && live.o) {
        const t = Number(live.t);
        const last = out[out.length - 1];
        const bar = { t, o: live.o, h: live.h, l: live.l, c: live.c, v: live.v ? Number(live.v) : undefined };
        if (last && last.t === t) out[out.length - 1] = bar;
        else if (!last || t > last.t) out.push(bar);
      }
    }
    return out;
  }

  @Get('quotes')
  quotesList(@Query('symbols') symbols?: string) {
    const ids = (symbols ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
    return this.quotes.quoteDtos(ids);
  }
}

@Controller('internal/trading')
@Public()
@UseGuards(InternalGuard)
export class InternalTradingController {
  constructor(private readonly trading: TradingService) {}

  @Get('index')
  index() {
    return this.trading.engineIndex();
  }

  @Post('close')
  close(@Body(new ZodPipe(internalCloseSchema)) body: z.infer<typeof internalCloseSchema>) {
    return this.trading.closeByEngine(body.positionId, body.reason, body.quote);
  }

  @Post('fill')
  fill(@Body(new ZodPipe(internalFillSchema)) body: z.infer<typeof internalFillSchema>) {
    return this.trading.fillPending(body.orderId, body.quote);
  }

  @Post('stop-out')
  stopOut(@Body(new ZodPipe(internalStopOutSchema)) body: z.infer<typeof internalStopOutSchema>) {
    return this.trading.stopOut(body.accountId);
  }

  @Post('margin-call')
  marginCall(@Body(new ZodPipe(internalMarginCallSchema)) body: z.infer<typeof internalMarginCallSchema>) {
    return this.trading.marginCall(body.accountId, body.level);
  }

  @Post('swap')
  swap(@Body(new ZodPipe(internalSwapSchema)) body: z.infer<typeof internalSwapSchema>) {
    return this.trading.accrueSwap(body.date);
  }
}

// NB: z.coerce.boolean() turns the string "false" into true — take the literal string and convert in the service
const adminPosQuery = paginationSchema.extend({
  open: z.enum(['true', 'false']).optional(),
  symbol: z.string().optional(),
  accountId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
const adminOrdQuery = paginationSchema.extend({ status: z.enum(['pending', 'filled', 'cancelled', 'rejected', 'expired']).optional() });
const forceCloseSchema = z.object({ reason: z.string().trim().min(3).max(300) });

@Controller('admin')
@Roles('admin', 'superadmin')
export class TradingAdminController {
  constructor(private readonly trading: TradingService) {}

  @Get('positions')
  positions(@Query(new ZodPipe(adminPosQuery)) q: z.infer<typeof adminPosQuery>) {
    return this.trading.adminPositions(q);
  }

  @Get('orders')
  orders(@Query(new ZodPipe(adminOrdQuery)) q: z.infer<typeof adminOrdQuery>) {
    return this.trading.adminOrders(q);
  }

  @Post('positions/:id/close')
  forceClose(@CurrentUser() actor: AuthUser, @ClientIp() ip: string, @Param('id') id: string, @Body(new ZodPipe(forceCloseSchema)) body: z.infer<typeof forceCloseSchema>) {
    return this.trading.adminForceClose({ id: actor.id, ip }, id, body.reason);
  }
}
