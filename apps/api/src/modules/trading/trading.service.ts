import { Injectable, Logger } from '@nestjs/common';
import { CloseReason, Order, Position, Prisma, TradingAccount } from '@prisma/client';
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
  WS_EVENTS,
  accountMath,
  hedgedUsedMargin,
  closePriceFor,
  dec,
  effectiveLeverage,
  fillPrice,
  floatingPnl,
  isStale,
  quoteCurrency,
  requiredMarginUsd,
  roundPrice,
  swapFor,
  toUsd,
  validateLots,
  validateSlTp,
  worstPosition,
  type ClosePositionResult,
  type ModifyPositionInput,
  type PlaceOrderInput,
  type PlaceOrderResult,
  type PriceBook,
  type Quote,
  type TradingEvent,
} from '@spova/shared';
import type { Decimal } from 'decimal.js';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { SettingsService } from '../../infra/settings.service';
import { MailService } from '../../infra/mail.service';
import { ActivityService } from '../../infra/activity.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { QuotesService, type SymbolSpec } from '../quotes/quotes.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ApiError } from '../../common/errors';
import { money, toDb } from '../../common/money';
import { orderToDto, positionToDto } from './trading.dto';

interface Actor {
  id: string | null;
  ip?: string;
  /** admin / internal callers may trade on accounts they do not own and on blocked accounts */
  privileged?: boolean;
}

const TRADING_CH = 'trading:events';

/**
 * The only writer of orders / positions. Money moves exclusively through LedgerService inside the same
 * transaction that locks the account row (ARCHITECTURE §07). The worker only *asks* for closes and fills.
 */
@Injectable()
export class TradingService {
  private readonly log = new Logger('Trading');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
    private readonly quotes: QuotesService,
    private readonly ws: RealtimeGateway,
    private readonly settings: SettingsService,
    private readonly activity: ActivityService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private emit(event: TradingEvent) {
    void this.redis.client.publish(TRADING_CH, JSON.stringify(event));
  }

  private async pushAccount(acc: TradingAccount) {
    const snap = await this.accounts.snapshot(acc);
    this.ws.accountSnapshot(acc.userId, snap);
    await this.redis.client.hset(`acct:${acc.id}`, { ...snap, marginLevel: snap.marginLevel ?? '' });
    this.emit({ type: 'account.changed', accountId: acc.id });
    return snap;
  }

  private async tradableSpec(symbolId: string): Promise<SymbolSpec> {
    const spec = await this.quotes.spec(symbolId);
    if (!spec || !spec.enabled) throw ApiError.badRequest('symbol_unknown', 'Unknown instrument');
    if (!this.quotes.isOpen(spec)) throw ApiError.unprocessable('market_closed', `${symbolId} is closed right now`);
    return spec;
  }

  private freshQuote(symbolId: string, book: PriceBook): Quote {
    const q = book[symbolId];
    if (isStale(q)) throw ApiError.unprocessable('quote_stale', `No live price for ${symbolId}. Try again in a moment.`);
    return q!;
  }

  /** account checks shared by open / close paths */
  async guardedAccount(accountId: string, actor: Actor, opts: { allowBlocked?: boolean; readOnly?: boolean } = {}) {
    const acc = await this.prisma.tradingAccount.findUnique({ where: { id: accountId }, include: { user: { select: { status: true } } } });
    if (!acc) throw ApiError.notFound('account_not_found', 'Trading account not found');
    if (!actor.privileged && acc.userId !== actor.id) throw ApiError.notFound('account_not_found', 'Trading account not found');
    if (opts.readOnly) return acc;
    if (acc.user.status !== 'active') throw ApiError.forbidden('account_frozen', 'Your account is restricted. Contact support.');
    if (acc.status !== 'enabled') throw ApiError.forbidden('account_disabled', `This account is ${acc.status}`);
    if (acc.tradingBlocked && !actor.privileged && !opts.allowBlocked) throw ApiError.forbidden('trading_blocked', 'Trading on this account has been disabled by the broker');
    return acc;
  }

  private async riskFor(tier: TradingAccount['tier']) {
    const rc = await this.prisma.riskConfig.findUnique({ where: { tier } });
    return { marginCall: dec(rc?.marginCallPct ?? 100), stopOut: dec(rc?.stopOutPct ?? 20) };
  }

  /** positions with live floating P/L for an account (null floating when no quote) */
  async livePositions(accountId: string, status: 'open' | 'closed' = 'open') {
    const [rows, book, specs] = await Promise.all([
      this.prisma.position.findMany({ where: { accountId, status }, orderBy: status === 'open' ? { openAt: 'desc' } : { closeAt: 'desc' }, take: status === 'closed' ? 200 : undefined }),
      this.quotes.book(),
      this.quotes.specs(),
    ]);
    return rows.map((p) => positionToDto(p, this.live(p, book, specs)));
  }

  private live(p: Position, book: PriceBook, specs: Map<string, SymbolSpec>) {
    if (p.status !== 'open') return null;
    const spec = specs.get(p.symbolId);
    const q = book[p.symbolId];
    if (!spec || !q) return null;
    const raw = floatingPnl({ side: p.side, openPrice: p.openPrice.toString(), lots: p.lots.toString(), contractSize: spec.contractSize.toString(), bid: q.bid, ask: q.ask });
    const usd = toUsd(raw, quoteCurrency(spec.id, spec.assetClass), book);
    return { currentPrice: closePriceFor(p.side, q).toString(), floatingUsd: usd ? money(usd) : money(0) };
  }

  // ---------------------------------------------------------------- orders

  async listOrders(accountId: string, status?: Order['status']) {
    const rows = await this.prisma.order.findMany({ where: { accountId, ...(status && { status }) }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map(orderToDto);
  }

  /** Market orders fill now; limit/stop are stored pending after a margin pre-check (not reserved). */
  async placeOrder(accountId: string, input: PlaceOrderInput, actor: Actor): Promise<PlaceOrderResult> {
    if (!(await this.redis.allow(`orders:${accountId}`, 10, 1))) throw ApiError.tooMany('Too many orders. Slow down.');
    const platform = await this.settings.getCached<PlatformSettings>('platform', DEFAULT_PLATFORM_SETTINGS);
    if (platform.tradingHalt.enabled) throw ApiError.forbidden('trading_halted', platform.tradingHalt.message || 'Trading is paused');
    const acc = await this.guardedAccount(accountId, actor);
    const spec = await this.tradableSpec(input.symbol);
    const lotsErr = validateLots(input.lots, spec.minLot.toString(), spec.maxLot.toString(), spec.lotStep.toString());
    if (lotsErr) throw ApiError.badRequest('lots_invalid', lotsErr);

    // idempotency: same clientRef on the same account returns the first result
    if (input.clientRef) {
      const dup = await this.prisma.order.findUnique({ where: { accountId_clientRef: { accountId, clientRef: input.clientRef } } });
      if (dup) {
        const pos = dup.positionId ? await this.prisma.position.findUnique({ where: { id: dup.positionId } }) : null;
        return { order: orderToDto(dup), position: pos ? positionToDto(pos) : null, account: await this.accounts.toDto(acc) };
      }
    }

    const book = await this.quotes.book();
    const q = this.freshQuote(spec.id, book);
    const leverage = effectiveLeverage(acc.leverage, spec.leverageMax);
    const refPrice = input.type === 'market' ? fillPrice(input.side, q) : dec(input.price!);
    const slTpErr = validateSlTp(input.side, refPrice, input.sl ?? null, input.tp ?? null);
    if (slTpErr) throw ApiError.badRequest('sl_tp_invalid', slTpErr);
    const margin = requiredMarginUsd({ lots: input.lots, contractSize: spec.contractSize.toString(), price: refPrice, leverage, quoteCcy: quoteCurrency(spec.id, spec.assetClass), book });
    if (!margin) throw ApiError.unprocessable('no_conversion', `No USD rate to value ${spec.id} right now`);

    const snap = await this.accounts.snapshot(acc);
    // hedged margin: an order that offsets existing exposure on the same symbol only needs the EXTRA margin
    const openPos = await this.prisma.position.findMany({ where: { accountId, status: 'open' }, select: { symbolId: true, side: true, marginUsed: true } });
    const current = openPos.map((pp) => ({ symbol: pp.symbolId, side: pp.side as 'buy' | 'sell', marginUsed: pp.marginUsed.toString() }));
    const addMargin = hedgedUsedMargin([...current, { symbol: spec.id, side: input.side, marginUsed: margin.toString() }]).minus(hedgedUsedMargin(current));
    if (dec(snap.freeMargin).lt(addMargin)) {
      throw ApiError.unprocessable('insufficient_margin', 'Not enough free margin for this order', { required: money(addMargin), freeMargin: snap.freeMargin });
    }

    if (input.type !== 'market') {
      // pending order: side-correct trigger price vs current quote
      const cur = fillPrice(input.side, q);
      const p = dec(input.price!);
      const wrong =
        (input.type === 'limit' && (input.side === 'buy' ? !p.lt(cur) : !p.gt(cur))) || (input.type === 'stop' && (input.side === 'buy' ? !p.gt(cur) : !p.lt(cur)));
      if (wrong) throw ApiError.badRequest('price_invalid', `A ${input.side} ${input.type} must be ${input.type === 'limit' ? (input.side === 'buy' ? 'below' : 'above') : input.side === 'buy' ? 'above' : 'below'} the current price`);
      const order = await this.prisma.order.create({
        data: { accountId, symbolId: spec.id, side: input.side, type: input.type, lots: input.lots, price: toPx(p, spec), sl: input.sl ? toPx(input.sl, spec) : null, tp: input.tp ? toPx(input.tp, spec) : null, clientRef: input.clientRef ?? null },
      });
      this.emit({ type: 'order.placed', accountId, symbol: spec.id, id: order.id });
      return { order: orderToDto(order), position: null, account: await this.accounts.toDto(acc) };
    }

    const { order, position, account } = await this.openPosition({ acc, spec, side: input.side, lots: input.lots, price: refPrice, margin, sl: input.sl ?? null, tp: input.tp ?? null, clientRef: input.clientRef ?? null, actor });
    return { order: orderToDto(order), position: positionToDto(position, this.live(position, book, await this.quotes.specs())), account: await this.accounts.toDto(account) };
  }

  /** Shared by market orders and pending-order fills: one transaction locks the account, inserts the filled order + open position. */
  private async openPosition(p: { acc: TradingAccount; spec: SymbolSpec; side: 'buy' | 'sell'; lots: string; price: Decimal; margin: Decimal; sl: string | null; tp: string | null; clientRef: string | null; actor: Actor; existingOrderId?: string }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM trading_accounts WHERE id = ${p.acc.id}::uuid FOR UPDATE`;
      if (!locked[0]) throw ApiError.notFound('account_not_found', 'Trading account not found');
      const position = await tx.position.create({
        data: { accountId: p.acc.id, symbolId: p.spec.id, side: p.side, lots: p.lots, openPrice: toPx(p.price, p.spec), sl: p.sl ? toPx(p.sl, p.spec) : null, tp: p.tp ? toPx(p.tp, p.spec) : null, marginUsed: toDb(p.margin) },
      });
      const order = p.existingOrderId
        ? await tx.order.update({ where: { id: p.existingOrderId }, data: { status: 'filled', filledPrice: toPx(p.price, p.spec), filledAt: new Date(), positionId: position.id } })
        : await tx.order.create({
            data: { accountId: p.acc.id, symbolId: p.spec.id, side: p.side, type: 'market', lots: p.lots, sl: p.sl ? toPx(p.sl, p.spec) : null, tp: p.tp ? toPx(p.tp, p.spec) : null, status: 'filled', filledPrice: toPx(p.price, p.spec), filledAt: new Date(), positionId: position.id, clientRef: p.clientRef },
          });
      const account = await tx.tradingAccount.findUniqueOrThrow({ where: { id: p.acc.id } });
      return { order, position, account };
    });
    this.ws.user(result.account.userId, WS_EVENTS.ORDER_FILLED, orderToDto(result.order));
    this.ws.user(result.account.userId, WS_EVENTS.POSITION_OPENED, positionToDto(result.position));
    this.ws.admin(WS_EVENTS.ADMIN_POSITION, { type: 'opened', position: positionToDto(result.position), userId: result.account.userId });
    void this.activity.record({ userId: result.account.userId, kind: 'trade_open', title: 'Opened a trade', detail: `${p.side.toUpperCase()} ${p.lots} ${p.spec.id}`, meta: { symbol: p.spec.id, side: p.side, lots: p.lots } });
    this.emit({ type: 'position.opened', accountId: p.acc.id, symbol: p.spec.id, id: result.position.id });
    await this.pushAccount(result.account);
    return result;
  }

  async cancelOrder(accountId: string, orderId: string, actor: Actor) {
    const acc = await this.guardedAccount(accountId, actor, { allowBlocked: true });
    const order = await this.prisma.order.findFirst({ where: { id: orderId, accountId } });
    if (!order) throw ApiError.notFound('order_not_found', 'Order not found');
    if (order.status !== 'pending') throw ApiError.conflict('not_pending', `Order is already ${order.status}`);
    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status: 'cancelled', rejectReason: actor.privileged ? 'cancelled by broker' : null } });
    this.ws.user(acc.userId, WS_EVENTS.ORDER_CANCELLED, orderToDto(updated));
    this.emit({ type: 'order.cancelled', accountId, symbol: order.symbolId, id: orderId });
    return orderToDto(updated);
  }

  /** Worker-triggered fill of a pending limit/stop order at the trigger-side quote; margin re-checked. */
  async fillPending(orderId: string, quote: Quote) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('order_not_found', 'Order not found');
    if (order.status !== 'pending') return { order: orderToDto(order), filled: false };
    const acc = await this.prisma.tradingAccount.findUniqueOrThrow({ where: { id: order.accountId }, include: { user: { select: { status: true } } } });
    const spec = await this.quotes.spec(order.symbolId);
    const reject = async (reason: string) => {
      const rejected = await this.prisma.order.update({ where: { id: orderId }, data: { status: 'rejected', rejectReason: reason } });
      this.ws.user(acc.userId, WS_EVENTS.ORDER_REJECTED, orderToDto(rejected));
      this.emit({ type: 'order.rejected', accountId: acc.id, symbol: order.symbolId, id: orderId });
      return { order: orderToDto(rejected), filled: false };
    };
    if (!spec || !spec.enabled || !this.quotes.isOpen(spec)) return reject('market closed');
    if (acc.status !== 'enabled' || acc.tradingBlocked || acc.user.status !== 'active') return reject('account not tradable');

    const book = { ...(await this.quotes.book()), [spec.id]: quote };
    const price = fillPrice(order.side, quote);
    const leverage = effectiveLeverage(acc.leverage, spec.leverageMax);
    const margin = requiredMarginUsd({ lots: order.lots.toString(), contractSize: spec.contractSize.toString(), price, leverage, quoteCcy: quoteCurrency(spec.id, spec.assetClass), book });
    if (!margin) return reject('no USD rate');
    const snap = await this.accounts.snapshot(acc);
    if (dec(snap.freeMargin).lt(margin)) return reject(`insufficient margin (needs ${money(margin)}, free ${snap.freeMargin})`);

    const r = await this.openPosition({ acc, spec, side: order.side, lots: order.lots.toString(), price, margin, sl: order.sl?.toString() ?? null, tp: order.tp?.toString() ?? null, clientRef: null, actor: { id: null, privileged: true }, existingOrderId: orderId });
    this.emit({ type: 'order.filled', accountId: acc.id, symbol: spec.id, id: orderId });
    return { order: orderToDto(r.order), filled: true, position: positionToDto(r.position) };
  }

  // ---------------------------------------------------------------- positions

  async modifyPosition(accountId: string, positionId: string, input: ModifyPositionInput, actor: Actor) {
    const acc = await this.guardedAccount(accountId, actor);
    const pos = await this.prisma.position.findFirst({ where: { id: positionId, accountId } });
    if (!pos || pos.status !== 'open') throw ApiError.notFound('position_not_found', 'Open position not found');
    const spec = await this.quotes.spec(pos.symbolId);
    const q = await this.quotes.quote(pos.symbolId);
    const ref = q ? closePriceFor(pos.side, q) : pos.openPrice.toString();
    const sl = input.sl === undefined ? pos.sl?.toString() ?? null : input.sl;
    const tp = input.tp === undefined ? pos.tp?.toString() ?? null : input.tp;
    const err = validateSlTp(pos.side, ref, sl, tp);
    if (err) throw ApiError.badRequest('sl_tp_invalid', err);
    const updated = await this.prisma.position.update({ where: { id: positionId }, data: { sl: sl && spec ? toPx(sl, spec) : sl, tp: tp && spec ? toPx(tp, spec) : tp } });
    const dto = positionToDto(updated, spec && q ? this.live(updated, { [spec.id]: q, ...(await this.quotes.book()) }, await this.quotes.specs()) : null);
    this.ws.user(acc.userId, WS_EVENTS.POSITION_UPDATED, dto);
    this.emit({ type: 'position.updated', accountId, symbol: pos.symbolId, id: positionId });
    return dto;
  }

  /** User / admin close at the current quote (full or partial). */
  async closeByUser(accountId: string, positionId: string, lots: string | undefined, actor: Actor, reason: CloseReason = 'user'): Promise<ClosePositionResult> {
    const acc = await this.guardedAccount(accountId, actor);
    const pos = await this.prisma.position.findFirst({ where: { id: positionId, accountId } });
    if (!pos || pos.status !== 'open') throw ApiError.notFound('position_not_found', 'Open position not found');
    const spec = await this.tradableSpec(pos.symbolId);
    const q = this.freshQuote(spec.id, await this.quotes.book());
    return this.closePosition(pos, q, reason, actor, lots);
  }

  /** Worker-triggered close (SL / TP / stop-out) at the quote the worker saw. Idempotent. */
  async closeByEngine(positionId: string, reason: 'sl' | 'tp' | 'stopout', quote: Quote) {
    const pos = await this.prisma.position.findUnique({ where: { id: positionId } });
    if (!pos) throw ApiError.notFound('position_not_found', 'Position not found');
    if (pos.status !== 'open') return { position: positionToDto(pos), realizedPnl: pos.realizedPnl ? money(pos.realizedPnl) : '0.00', account: null };
    return this.closePosition(pos, quote, reason, { id: null, privileged: true });
  }

  /**
   * Close (full or partial) in one transaction: lock account -> realise P/L through the ledger -> update position
   * -> position_closes row. Stop-out closes may take the balance negative; it is then clamped back to 0 with an
   * `adjustment` entry (negative balance protection).
   */
  private async closePosition(pos: Position, quote: Quote, reason: CloseReason, actor: Actor, lotsRequested?: string): Promise<ClosePositionResult> {
    const spec = (await this.quotes.spec(pos.symbolId)) ?? (await this.prisma.symbol.findUniqueOrThrow({ where: { id: pos.symbolId }, include: { sessions: true } }));
    const book = { ...(await this.quotes.book()), [pos.symbolId]: quote };
    const closeLots = lotsRequested ? dec(lotsRequested) : dec(pos.lots);
    if (closeLots.lte(0) || closeLots.gt(pos.lots)) throw ApiError.badRequest('lots_invalid', 'Close volume exceeds the open volume');
    const partial = closeLots.lt(pos.lots);
    if (partial) {
      const lotsErr = validateLots(closeLots, spec.minLot.toString(), spec.maxLot.toString(), spec.lotStep.toString());
      if (lotsErr) throw ApiError.badRequest('lots_invalid', lotsErr);
    }
    const price = closePriceFor(pos.side, quote);
    const rawPnl = floatingPnl({ side: pos.side, openPrice: pos.openPrice.toString(), lots: closeLots, contractSize: spec.contractSize.toString(), bid: quote.bid, ask: quote.ask });
    const pnlUsd = toUsd(rawPnl, quoteCurrency(spec.id, spec.assetClass), book);
    if (!pnlUsd) throw ApiError.unprocessable('no_conversion', `No USD rate to value ${spec.id} right now`);
    const pnl = pnlUsd.toDecimalPlaces(2);
    const share = closeLots.div(pos.lots);

    const out = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM trading_accounts WHERE id = ${pos.accountId}::uuid FOR UPDATE`;
      if (!locked[0]) throw ApiError.notFound('account_not_found', 'Trading account not found');
      const fresh = await tx.position.findUniqueOrThrow({ where: { id: pos.id } });
      if (fresh.status !== 'open') throw ApiError.conflict('already_closed', 'Position is already closed');

      let entryId: string | null = null;
      let account: TradingAccount;
      if (!pnl.isZero()) {
        const r = await this.ledger.postInTx(tx, {
          accountId: pos.accountId,
          type: 'pnl',
          amount: pnl,
          reason: `${partial ? 'Partial close' : 'Close'} ${pos.side} ${closeLots.toString()} ${pos.symbolId} @ ${roundPrice(price, spec.digits).toString()} (${reason})`,
          refType: 'position',
          refId: pos.id,
          actorId: actor.id,
          allowNegative: true,
        });
        entryId = r.entryId;
        account = r.account;
      } else {
        account = await tx.tradingAccount.findUniqueOrThrow({ where: { id: pos.accountId } });
      }
      // negative balance protection: a gap through stop-out never leaves the client owing money
      if (dec(account.balance).lt(0)) {
        const fix = await this.ledger.postInTx(tx, { accountId: pos.accountId, type: 'adjustment', amount: dec(account.balance).negated(), reason: 'Negative balance protection', refType: 'position', refId: pos.id, actorId: null, allowNegative: true });
        account = fix.account;
      }

      const data: Prisma.PositionUpdateInput = partial
        ? { lots: toDb(dec(pos.lots).minus(closeLots)), marginUsed: toDb(dec(pos.marginUsed).times(dec(1).minus(share))) }
        : { status: 'closed', closePrice: toPx(price, spec), closeAt: new Date(), realizedPnl: toDb(pnl), closeReason: reason, closedBy: actor.id };
      const updated = await tx.position.update({ where: { id: pos.id }, data });
      await tx.positionClose.create({
        data: { positionId: pos.id, lots: toDb(closeLots), price: toPx(price, spec), pnl: toDb(pnl), reason, ledgerEntryId: entryId ?? (await placeholderEntry(tx, pos)) },
      });
      return { updated, account };
    });

    const dto = positionToDto(out.updated, partial ? this.live(out.updated, book, await this.quotes.specs()) : null);
    this.ws.user(out.account.userId, partial ? WS_EVENTS.POSITION_UPDATED : WS_EVENTS.POSITION_CLOSED, { ...dto, closeReason: reason, closedLots: closeLots.toString(), closedPnl: money(pnl) });
    this.ws.admin(WS_EVENTS.ADMIN_POSITION, { type: partial ? 'partial' : 'closed', position: dto, reason, pnl: money(pnl), userId: out.account.userId });
    void this.activity.record({ userId: out.account.userId, kind: 'trade_close', title: partial ? 'Partially closed a trade' : 'Closed a trade', detail: `${pos.side.toUpperCase()} ${closeLots.toString()} ${pos.symbolId} · P/L ${money(pnl)} USD (${reason})`, meta: { symbol: pos.symbolId, lots: closeLots.toString(), pnl: money(pnl), reason } });
    this.emit({ type: partial ? 'position.updated' : 'position.closed', accountId: pos.accountId, symbol: pos.symbolId, id: pos.id });
    await this.pushAccount(out.account);
    if (reason === 'sl' || reason === 'tp') {
      this.ws.notice(out.account.userId, { type: 'ledger', title: `${reason === 'tp' ? 'Take profit' : 'Stop loss'} hit on ${pos.symbolId}`, body: `${pos.side} ${closeLots} lots closed at ${roundPrice(price, spec.digits)} · P/L ${money(pnl)} USD`, level: pnl.gte(0) ? 'success' : 'warning' });
    }
    return { position: dto, realizedPnl: money(pnl), account: await this.accounts.toDto(out.account) };
  }

  // ---------------------------------------------------------------- risk actions (worker -> api)

  async marginCall(accountId: string, level: string) {
    const acc = await this.prisma.tradingAccount.findUnique({ where: { id: accountId } });
    if (!acc) throw ApiError.notFound('account_not_found', 'Trading account not found');
    if (acc.marginCallAt && Date.now() - acc.marginCallAt.getTime() < 3600_000) return { notified: false };
    await this.prisma.tradingAccount.update({ where: { id: accountId }, data: { marginCallAt: new Date() } });
    this.ws.notice(acc.userId, { type: 'margin_call', title: 'Margin call', body: `Margin level on account ${acc.loginCode} is ${dec(level).toFixed(0)}%. Add funds or reduce exposure to avoid a stop-out.`, level: 'danger' });
    const u = await this.prisma.user.findUnique({ where: { id: acc.userId }, select: { email: true, profile: { select: { notifEmail: true } } } });
    if (u?.profile?.notifEmail) void this.mail.ledgerNotice(u.email, `Margin call on account ${acc.loginCode}`, `Your margin level is ${dec(level).toFixed(0)}%. Positions are closed automatically below the stop-out level.`).catch(() => undefined);
    return { notified: true };
  }

  /** Close the worst position first until the level is back above stop-out (or nothing is left). */
  async stopOut(accountId: string) {
    const acc = await this.prisma.tradingAccount.findUnique({ where: { id: accountId } });
    if (!acc) throw ApiError.notFound('account_not_found', 'Trading account not found');
    const risk = await this.riskFor(acc.tier);
    const closed: string[] = [];
    for (let i = 0; i < 50; i++) {
      const [positions, book, specs, fresh] = await Promise.all([
        this.prisma.position.findMany({ where: { accountId, status: 'open' } }),
        this.quotes.book(),
        this.quotes.specs(),
        this.prisma.tradingAccount.findUniqueOrThrow({ where: { id: accountId } }),
      ]);
      if (positions.length === 0) break;
      const rows = positions.map((p) => ({ p, marginUsed: p.marginUsed.toString(), floatingUsd: dec(this.live(p, book, specs)?.floatingUsd ?? 0) }));
      const m = accountMath(fresh.balance.toString(), fresh.credit.toString(), rows.map((r) => ({ symbol: r.p.symbolId, side: r.p.side as 'buy' | 'sell', marginUsed: r.marginUsed, floatingUsd: r.floatingUsd })));
      if (!m.marginLevel || m.marginLevel.gt(risk.stopOut)) break;
      const worst = worstPosition(rows)!;
      const q = book[worst.p.symbolId];
      if (!q) break; // cannot price it; leave for the next tick
      await this.closePosition(worst.p, q, 'stopout', { id: null, privileged: true });
      closed.push(worst.p.id);
    }
    if (closed.length) {
      this.ws.notice(acc.userId, { type: 'stop_out', title: 'Stop-out', body: `${closed.length} position${closed.length > 1 ? 's' : ''} on account ${acc.loginCode} closed automatically: margin level fell below ${risk.stopOut.toFixed(0)}%.`, level: 'danger' });
      this.ws.admin(WS_EVENTS.ADMIN_STOPOUT, { accountId, userId: acc.userId, closed });
    }
    return { closed };
  }

  /** Nightly swap: lots x rate (x3 Wednesday) per open position -> ledger `swap`, mirrored into swap_accrued. Idempotent per date. */
  async accrueSwap(date: string) {
    const key = `swap:done:${date}`;
    if (!(await this.redis.client.set(key, '1', 'EX', 7 * 86400, 'NX'))) return { applied: 0, skipped: true };
    const day = new Date(`${date}T00:00:00Z`);
    const [positions, specs, freeAccts] = await Promise.all([
      this.prisma.position.findMany({ where: { status: 'open' } }),
      this.quotes.specs(),
      this.prisma.tradingAccount.findMany({ where: { swapFree: true }, select: { id: true } }).then((rows) => new Set(rows.map((r) => r.id))),
    ]);
    const touched = new Set<string>();
    let applied = 0;
    for (const p of positions) {
      const spec = specs.get(p.symbolId) ?? (await this.prisma.symbol.findUnique({ where: { id: p.symbolId }, include: { sessions: true } }));
      if (!spec) continue;
      if (freeAccts.has(p.accountId)) continue; // admin made this account swap-free
      const swap = swapFor(p.lots.toString(), p.side, spec.swapLong.toString(), spec.swapShort.toString(), day).toDecimalPlaces(2);
      if (swap.isZero()) continue;
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM trading_accounts WHERE id = ${p.accountId}::uuid FOR UPDATE`;
        await this.ledger.postInTx(tx, { accountId: p.accountId, type: 'swap', amount: swap, reason: `Overnight swap ${p.side} ${p.lots} ${p.symbolId} (${date})`, refType: 'position', refId: p.id, actorId: null, allowNegative: true });
        await tx.position.update({ where: { id: p.id }, data: { swapAccrued: { increment: toDb(swap) } } });
      });
      touched.add(p.accountId);
      applied++;
    }
    for (const id of touched) {
      const acc = await this.prisma.tradingAccount.findUnique({ where: { id } });
      if (acc) await this.pushAccount(acc);
    }
    return { applied, skipped: false };
  }

  /** Everything the worker needs to run the risk loop without touching the DB. */
  async engineIndex() {
    const [positions, orders, specs, risk] = await Promise.all([
      this.prisma.position.findMany({ where: { status: 'open' } }),
      this.prisma.order.findMany({ where: { status: 'pending' } }),
      this.quotes.specs(),
      this.prisma.riskConfig.findMany(),
    ]);
    const accountIds = [...new Set([...positions.map((p) => p.accountId), ...orders.map((o) => o.accountId)])];
    const accounts = accountIds.length ? await this.prisma.tradingAccount.findMany({ where: { id: { in: accountIds } } }) : [];
    const riskByTier = new Map(risk.map((r) => [r.tier, r]));
    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        userId: a.userId,
        balance: money(a.balance),
        credit: money(a.credit),
        leverage: a.leverage,
        tier: a.tier,
        marginCallPct: riskByTier.get(a.tier)?.marginCallPct.toString() ?? '100',
        stopOutPct: riskByTier.get(a.tier)?.stopOutPct.toString() ?? '20',
      })),
      positions: positions.map((p) => positionToDto(p)),
      orders: orders.map(orderToDto),
      symbols: [...specs.values()].map((s) => ({ id: s.id, contractSize: s.contractSize.toString(), digits: s.digits, assetClass: s.assetClass, leverageMax: s.leverageMax })),
    };
  }

  // ---------------------------------------------------------------- admin

  async adminPositions(q: { open?: boolean; symbol?: string; accountId?: string; page: number; limit: number }) {
    const where: Prisma.PositionWhereInput = { ...(q.open !== false && { status: 'open' }), ...(q.symbol && { symbolId: q.symbol }), ...(q.accountId && { accountId: q.accountId }) };
    const [total, rows, book, specs] = await Promise.all([
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({ where, orderBy: { openAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { account: { select: { loginCode: true, type: true, user: { select: { id: true, email: true } } } } } }),
      this.quotes.book(),
      this.quotes.specs(),
    ]);
    return {
      items: rows.map((p) => ({ ...positionToDto(p, this.live(p, book, specs)), account: { loginCode: p.account.loginCode, type: p.account.type }, user: p.account.user })),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async adminOrders(q: { status?: Order['status']; page: number; limit: number }) {
    const where: Prisma.OrderWhereInput = { ...(q.status && { status: q.status }) };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { account: { select: { loginCode: true, user: { select: { id: true, email: true } } } } } }),
    ]);
    return { items: rows.map((o) => ({ ...orderToDto(o), account: { loginCode: o.account.loginCode }, user: o.account.user })), total, page: q.page, limit: q.limit };
  }

  async adminForceClose(actor: { id: string; ip?: string }, positionId: string, reason: string) {
    const pos = await this.prisma.position.findUnique({ where: { id: positionId } });
    if (!pos || pos.status !== 'open') throw ApiError.notFound('position_not_found', 'Open position not found');
    const spec = await this.quotes.spec(pos.symbolId);
    const q = spec ? this.freshQuote(spec.id, await this.quotes.book()) : undefined;
    if (!q) throw ApiError.unprocessable('quote_stale', 'No live price to close at');
    const r = await this.closePosition(pos, q, 'admin', { id: actor.id, ip: actor.ip, privileged: true });
    await this.prisma.adminAudit.create({ data: { actorId: actor.id, action: 'position.force_close', targetType: 'position', targetId: positionId, after: { reason, pnl: r.realizedPnl, price: r.position.closePrice }, ip: actor.ip } });
    return r;
  }
}

const toPx = (v: Decimal | string, spec: { digits: number }) => new Prisma.Decimal(roundPrice(v, spec.digits).toFixed(spec.digits));

/** position_closes.ledger_entry_id is NOT NULL; a zero-P/L close has no ledger row, so record a 0 adjustment to keep the trail complete. */
async function placeholderEntry(tx: Prisma.TransactionClient, pos: Position) {
  const acc = await tx.tradingAccount.findUniqueOrThrow({ where: { id: pos.accountId } });
  const e = await tx.ledgerEntry.create({
    data: { accountId: pos.accountId, type: 'pnl', amount: new Prisma.Decimal(0), balanceAfter: acc.balance, creditAfter: acc.credit, reason: `Close ${pos.symbolId} at break-even`, refType: 'position', refId: pos.id },
  });
  return e.id;
}
