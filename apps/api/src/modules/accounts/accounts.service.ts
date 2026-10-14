import { Injectable } from '@nestjs/common';
import { AccountType, Prisma, type Tier, TradingAccount } from '@prisma/client';
import { DEFAULT_PLATFORM_SETTINGS, type AccountDto, type PlatformSettings, type WsAccountSnapshot } from '@spova/shared';
import { SettingsService } from '../../infra/settings.service';
import { PrismaService } from '../../infra/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { D, money } from '../../common/money';
import { accountMath, dec, floatingPnl, quoteCurrency, toUsd } from '@spova/shared';
import { QuotesService } from '../quotes/quotes.service';
import { env } from '../../config/env';
import { ApiError } from '../../common/errors';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly quotes: QuotesService,
    private readonly settings: SettingsService,
  ) {}

  /** 6-digit login code shown to the user (like MT logins). Retries on collision. */
  private async nextLoginCode(tx: Prisma.TransactionClient): Promise<number> {
    for (let i = 0; i < 10; i++) {
      const code = 100000 + Math.floor(Math.random() * 900000);
      const exists = await tx.tradingAccount.findUnique({ where: { loginCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new Error('Could not allocate login code');
  }

  /** Create demo (funded from DEMO_START_BALANCE via ledger) or live (balance 0). */
  async createInTx(tx: Prisma.TransactionClient, userId: string, type: AccountType, actorId: string | null = null) {
    const risk = await tx.riskConfig.findUnique({ where: { tier: 'classic' } });
    const leverage = risk?.defaultLeverage ?? env.DEMO_DEFAULT_LEVERAGE;

    const account = await tx.tradingAccount.create({
      data: {
        userId,
        type,
        loginCode: await this.nextLoginCode(tx),
        tier: 'classic',
        currency: 'USD',
        leverage,
      },
    });

    if (type === 'demo') {
      const start = D(env.DEMO_START_BALANCE);
      if (start.gt(0)) {
        const r = await this.ledger.postInTx(tx, {
          accountId: account.id,
          type: 'credit',
          amount: start,
          reason: 'Demo account opening balance',
          refType: 'system',
          actorId,
        });
        return r.account;
      }
    }
    return account;
  }

  async create(userId: string, type: AccountType) {
    if (type === 'live') {
      const platform = await this.settings.getCached<PlatformSettings>('platform', DEFAULT_PLATFORM_SETTINGS);
      if (!platform.liveAccountsOpen) throw ApiError.forbidden('live_accounts_closed', 'Live account opening is paused at the moment');
    }
    const count = await this.prisma.tradingAccount.count({ where: { userId, type } });
    if (type === 'demo' && count >= 5) throw ApiError.conflict('demo_limit', 'Maximum 5 demo accounts');
    if (type === 'live' && count >= 1) throw ApiError.conflict('live_limit', 'You already have a live account');

    const account = await this.prisma.$transaction((tx) => this.createInTx(tx, userId, type));
    // opening a live account starts the 15-day window to upload documents (trading pauses after that if missing)
    if (type === 'live') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycDeadlineAt: true } });
      if (!u?.kycDeadlineAt) await this.prisma.user.update({ where: { id: userId }, data: { kycDeadlineAt: new Date(Date.now() + 15 * 86_400_000), kycReminderSentAt: null } });
    }
    return account;
  }

  /** Admin opens an account for a client: no self-serve limit, optional tier/leverage. Returns the DTO. */
  async adminCreate(userId: string, type: AccountType, opts: { tier?: Tier; leverage?: number } = {}) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw ApiError.notFound('user_not_found', 'User not found');
    const account = await this.prisma.$transaction(async (tx) => {
      const acc = await this.createInTx(tx, userId, type);
      if (opts.tier || opts.leverage) {
        return tx.tradingAccount.update({ where: { id: acc.id }, data: { ...(opts.tier && { tier: opts.tier }), ...(opts.leverage && { leverage: opts.leverage }) } });
      }
      return acc;
    });
    if (type === 'live') {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycDeadlineAt: true } });
      if (!u?.kycDeadlineAt) await this.prisma.user.update({ where: { id: userId }, data: { kycDeadlineAt: new Date(Date.now() + 15 * 86_400_000), kycReminderSentAt: null } });
    }
    return this.toDto(account);
  }

  listForUser(userId: string) {
    return this.prisma.tradingAccount.findMany({ where: { userId }, orderBy: [{ type: 'asc' }, { createdAt: 'asc' }] });
  }

  async getOwned(userId: string, accountId: string) {
    const acc = await this.prisma.tradingAccount.findFirst({ where: { id: accountId, userId } });
    if (!acc) throw ApiError.notFound('account_not_found', 'Trading account not found');
    return acc;
  }

  /**
   * Live account math (ARCHITECTURE §08): balance + credit + floating P/L of open positions at current prices.
   * Prices come from Redis (worker); when a quote is missing the position contributes 0 floating.
   */
  async snapshot(acc: TradingAccount): Promise<WsAccountSnapshot> {
    const [positions, book, specs] = await Promise.all([
      this.prisma.position.findMany({ where: { accountId: acc.id, status: 'open' } }),
      this.quotes.book(),
      this.quotes.specs(),
    ]);
    const rows = positions.map((p) => {
      const spec = specs.get(p.symbolId);
      const q = book[p.symbolId];
      let floatingUsd = dec(0);
      if (spec && q) {
        const raw = floatingPnl({ side: p.side, openPrice: p.openPrice.toString(), lots: p.lots.toString(), contractSize: spec.contractSize.toString(), bid: q.bid, ask: q.ask });
        floatingUsd = toUsd(raw, quoteCurrency(spec.id, spec.assetClass), book) ?? dec(0);
      }
      // swap accrues against equity while the trade is open (it is settled into the balance at close)
      floatingUsd = floatingUsd.plus(dec(p.swapAccrued));
      return { symbol: p.symbolId, side: p.side as 'buy' | 'sell', marginUsed: p.marginUsed.toString(), floatingUsd };
    });
    const m = accountMath(acc.balance.toString(), acc.credit.toString(), rows);
    return {
      accountId: acc.id,
      balance: money(acc.balance),
      credit: money(acc.credit),
      equity: money(m.equity),
      usedMargin: money(m.usedMargin),
      freeMargin: money(m.freeMargin),
      marginLevel: m.marginLevel ? m.marginLevel.toFixed(2) : null,
      ts: Date.now(),
    };
  }

  async toDto(acc: TradingAccount): Promise<AccountDto> {
    const s = await this.snapshot(acc);
    return {
      id: acc.id,
      type: acc.type,
      loginCode: acc.loginCode,
      tier: acc.tier,
      currency: acc.currency,
      leverage: acc.leverage,
      balance: s.balance,
      credit: s.credit,
      equity: s.equity,
      usedMargin: s.usedMargin,
      freeMargin: s.freeMargin,
      marginLevel: s.marginLevel,
      status: acc.status,
      tradingBlocked: acc.tradingBlocked,
      swapFree: acc.swapFree,
      usdRate: acc.usdRate ? acc.usdRate.toString() : null,
      createdAt: acc.createdAt.toISOString(),
    };
  }
}
