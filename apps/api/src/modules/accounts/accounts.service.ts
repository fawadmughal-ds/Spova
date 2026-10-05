import { Injectable } from '@nestjs/common';
import { AccountType, Prisma, TradingAccount } from '@prisma/client';
import type { AccountDto, WsAccountSnapshot } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { D, money } from '../../common/money';
import { env } from '../../config/env';
import { ApiError } from '../../common/errors';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
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
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.kycPoi || !user.kycPor) {
        throw ApiError.forbidden('kyc_required', 'Complete identity and address verification before opening a live account');
      }
    }
    const count = await this.prisma.tradingAccount.count({ where: { userId, type } });
    if (type === 'demo' && count >= 3) throw ApiError.conflict('demo_limit', 'Maximum 3 demo accounts');
    if (type === 'live' && count >= 1) throw ApiError.conflict('live_limit', 'You already have a live account');

    return this.prisma.$transaction((tx) => this.createInTx(tx, userId, type));
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
   * Phase 1: no open positions, so floating P/L and used margin are 0.
   * Phase 3 plugs the risk engine snapshot (Redis acct:{id}) in here.
   */
  snapshot(acc: TradingAccount): WsAccountSnapshot {
    const balance = D(acc.balance);
    const credit = D(acc.credit);
    const floating = D(0);
    const usedMargin = D(0);
    const equity = balance.plus(credit).plus(floating);
    const freeMargin = equity.minus(usedMargin);
    const marginLevel = usedMargin.gt(0) ? equity.div(usedMargin).times(100).toFixed(2) : null;
    return {
      accountId: acc.id,
      balance: money(balance),
      credit: money(credit),
      equity: money(equity),
      usedMargin: money(usedMargin),
      freeMargin: money(freeMargin),
      marginLevel,
      ts: Date.now(),
    };
  }

  toDto(acc: TradingAccount): AccountDto {
    const s = this.snapshot(acc);
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
      createdAt: acc.createdAt.toISOString(),
    };
  }
}
