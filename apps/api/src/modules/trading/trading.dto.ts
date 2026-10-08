import type { Order, Position } from '@prisma/client';
import type { OrderDto, PositionDto } from '@spova/shared';
import { money } from '../../common/money';

const px = (v: { toString(): string } | null | undefined) => (v === null || v === undefined ? null : v.toString());

export const positionToDto = (p: Position, live?: { currentPrice: string; floatingUsd: string } | null): PositionDto => ({
  id: p.id,
  accountId: p.accountId,
  symbol: p.symbolId,
  side: p.side,
  lots: p.lots.toString(),
  openPrice: p.openPrice.toString(),
  openAt: p.openAt.toISOString(),
  sl: px(p.sl),
  tp: px(p.tp),
  marginUsed: money(p.marginUsed),
  swapAccrued: money(p.swapAccrued),
  commission: money(p.commission),
  status: p.status,
  closePrice: px(p.closePrice),
  closeAt: p.closeAt?.toISOString() ?? null,
  realizedPnl: p.realizedPnl === null ? null : money(p.realizedPnl),
  closeReason: p.closeReason,
  currentPrice: live?.currentPrice ?? null,
  floatingPnl: live?.floatingUsd ?? null,
});

export const orderToDto = (o: Order): OrderDto => ({
  id: o.id,
  accountId: o.accountId,
  symbol: o.symbolId,
  side: o.side,
  type: o.type,
  lots: o.lots.toString(),
  price: px(o.price),
  sl: px(o.sl),
  tp: px(o.tp),
  status: o.status,
  filledPrice: px(o.filledPrice),
  filledAt: o.filledAt?.toISOString() ?? null,
  positionId: o.positionId,
  rejectReason: o.rejectReason,
  clientRef: o.clientRef,
  createdAt: o.createdAt.toISOString(),
});
