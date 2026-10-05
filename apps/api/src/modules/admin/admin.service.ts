import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminCreditInput,
  AdminDashboardDto,
  AdminDebitInput,
  AdminUserDetailDto,
  AdminUserRowDto,
} from '@spova/shared';
import { WS_EVENTS } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { MailService } from '../../infra/mail.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { D, money } from '../../common/money';
import { ApiError } from '../../common/errors';
import { ledgerToDto } from '../accounts/accounts.controller';

interface Actor {
  id: string;
  role: 'admin' | 'superadmin' | 'client';
  ip: string;
}

@Injectable()
export class AdminService {
  private readonly log = new Logger('Admin');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
    private readonly ws: RealtimeGateway,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- dashboard

  async dashboard(): Promise<AdminDashboardDto> {
    const weekAgo = new Date(Date.now() - 7 * 86400 * 1000);
    const [clients, newClients7d, pendingKyc, pendingPayments, openPositions, demoSum, liveSum] = await Promise.all([
      this.prisma.user.count({ where: { role: 'client' } }),
      this.prisma.user.count({ where: { role: 'client', createdAt: { gte: weekAgo } } }),
      this.prisma.kycDocument.count({ where: { status: 'pending' } }),
      this.prisma.paymentRequest.count({ where: { status: 'pending' } }),
      this.prisma.position.count({ where: { status: 'open' } }),
      this.prisma.tradingAccount.aggregate({ _sum: { balance: true }, where: { type: 'demo' } }),
      this.prisma.tradingAccount.aggregate({ _sum: { balance: true }, where: { type: 'live' } }),
    ]);
    return {
      clients,
      newClients7d,
      pendingKyc,
      pendingPayments,
      openPositions,
      demoBalanceTotal: money(demoSum._sum.balance),
      liveBalanceTotal: money(liveSum._sum.balance),
    };
  }

  // ---------------------------------------------------------------- users

  async listUsers(q: { q?: string; status?: string; page: number; limit: number }) {
    const where: Prisma.UserWhereInput = {
      role: 'client',
      ...(q.status ? { status: q.status as Prisma.UserWhereInput['status'] } : {}),
      ...(q.q
        ? {
            OR: [
              { email: { contains: q.q, mode: 'insensitive' } },
              { profile: { firstName: { contains: q.q, mode: 'insensitive' } } },
              { profile: { lastName: { contains: q.q, mode: 'insensitive' } } },
              { profile: { phone: { contains: q.q } } },
              ...(/^\d{6}$/.test(q.q) ? [{ accounts: { some: { loginCode: Number(q.q) } } }] : []),
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: true, accounts: { select: { balance: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    const items: AdminUserRowDto[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      countryCode: u.profile?.countryCode ?? null,
      kyc: { poi: u.kycPoi, por: u.kycPor },
      accountsCount: u.accounts.length,
      totalBalance: money(u.accounts.reduce((s, a) => s.plus(D(a.balance)), D(0))),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  async getUser(id: string): Promise<AdminUserDetailDto> {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { profile: true, accounts: { orderBy: { createdAt: 'asc' } } } });
    if (!u) throw ApiError.notFound('user_not_found', 'User not found');
    const me = this.auth.toMe(u);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      countryCode: u.profile?.countryCode ?? null,
      kyc: { poi: u.kycPoi, por: u.kycPor },
      accountsCount: u.accounts.length,
      totalBalance: money(u.accounts.reduce((s, a) => s.plus(D(a.balance)), D(0))),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastLoginIp: u.lastLoginIp,
      notes: u.adminNotes,
      profile: me.profile,
      accounts: u.accounts.map((a) => this.accounts.toDto(a)),
    };
  }

  async updateUser(actor: Actor, id: string, patch: { status?: 'active' | 'frozen' | 'closed'; notes?: string | null }) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { status: true, adminNotes: true, role: true } });
    if (!before) throw ApiError.notFound('user_not_found', 'User not found');
    if (before.role !== 'client' && actor.role !== 'superadmin') throw ApiError.forbidden('staff_protected', 'Only superadmin can modify staff');

    const after = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.notes !== undefined && { adminNotes: patch.notes }),
        },
        select: { status: true, adminNotes: true },
      });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: patch.status && patch.status !== before.status ? `user.${patch.status}` : 'user.update',
          targetType: 'user',
          targetId: id,
          before: { status: before.status, notes: before.adminNotes },
          after: { status: u.status, notes: u.adminNotes },
          ip: actor.ip,
        },
      });
      return u;
    });

    if (patch.status && patch.status !== 'active') {
      await this.auth.revokeAllSessions(id);
      this.ws.notice(id, { type: 'trading_blocked', title: 'Account ' + patch.status, body: 'Your account access has been restricted. Contact support.', level: 'danger' });
    }
    return after;
  }

  // ---------------------------------------------------------------- accounts

  async updateAccount(
    actor: Actor,
    accountId: string,
    patch: { leverage?: number; tier?: 'classic' | 'silver' | 'gold' | 'platinum' | 'vip'; status?: 'enabled' | 'disabled' | 'readonly'; tradingBlocked?: boolean },
  ) {
    const before = await this.prisma.tradingAccount.findUnique({ where: { id: accountId } });
    if (!before) throw ApiError.notFound('account_not_found', 'Account not found');

    if (patch.leverage !== undefined) {
      const risk = await this.prisma.riskConfig.findUnique({ where: { tier: patch.tier ?? before.tier } });
      if (risk && patch.leverage > risk.maxLeverage) {
        throw ApiError.unprocessable('leverage_too_high', `Max leverage for ${patch.tier ?? before.tier} is 1:${risk.maxLeverage}`);
      }
      // Phase 3: recompute margin_used for open positions and reject if margin level < stop-out.
    }

    const after = await this.prisma.$transaction(async (tx) => {
      const a = await tx.tradingAccount.update({ where: { id: accountId }, data: patch });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: 'account.update',
          targetType: 'account',
          targetId: accountId,
          before: { leverage: before.leverage, tier: before.tier, status: before.status, tradingBlocked: before.tradingBlocked },
          after: { leverage: a.leverage, tier: a.tier, status: a.status, tradingBlocked: a.tradingBlocked },
          ip: actor.ip,
        },
      });
      return a;
    });

    this.ws.accountSnapshot(after.userId, this.accounts.snapshot(after));
    if (patch.tradingBlocked === true) {
      this.ws.notice(after.userId, { type: 'trading_blocked', title: 'Trading disabled', body: `Trading on account ${after.loginCode} has been disabled by the broker.`, level: 'warning' });
    }
    return this.accounts.toDto(after);
  }

  /** POST /admin/accounts/:id/credit  {amount, reason, type: deposit|credit|bonus} */
  async credit(actor: Actor, accountId: string, input: AdminCreditInput) {
    const amount = D(input.amount);
    const bucket = input.type === 'bonus' ? 'credit' : 'balance';

    const { result, entryId } = await this.prisma.$transaction(async (tx) => {
      const result = await this.ledger.postInTx(tx, {
        accountId,
        type: input.type,
        amount,
        reason: input.reason,
        refType: 'admin',
        refId: actor.id,
        actorId: actor.id,
        bucket,
      });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: `account.${input.type}`,
          targetType: 'account',
          targetId: accountId,
          before: { balance: result.balanceAfter.minus(bucket === 'balance' ? amount : 0).toFixed(2), credit: result.creditAfter.minus(bucket === 'credit' ? amount : 0).toFixed(2) },
          after: { balance: result.balanceAfter.toFixed(2), credit: result.creditAfter.toFixed(2), amount: amount.toFixed(2), reason: input.reason },
          ip: actor.ip,
        },
      });
      return { result, entryId: result.entryId };
    });

    await this.afterMoneyChange(result.account.userId, result.account, `+${money(amount)} ${result.account.currency} ${input.type}`, input.reason);
    return { entryId, account: this.accounts.toDto(result.account) };
  }

  /** POST /admin/accounts/:id/debit  {amount, reason, type: withdraw|debit|fee, force?} */
  async debit(actor: Actor, accountId: string, input: AdminDebitInput) {
    const amount = D(input.amount).negated();
    const force = input.force && actor.role === 'superadmin';

    const { result, entryId } = await this.prisma.$transaction(async (tx) => {
      const result = await this.ledger.postInTx(tx, {
        accountId,
        type: input.type,
        amount,
        reason: input.reason,
        refType: 'admin',
        refId: actor.id,
        actorId: actor.id,
        bucket: 'balance',
        allowNegative: force,
      });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: `account.${input.type}`,
          targetType: 'account',
          targetId: accountId,
          before: { balance: result.balanceAfter.minus(amount).toFixed(2) },
          after: { balance: result.balanceAfter.toFixed(2), amount: amount.toFixed(2), reason: input.reason, force: !!force },
          ip: actor.ip,
        },
      });
      return { result, entryId: result.entryId };
    });

    await this.afterMoneyChange(result.account.userId, result.account, `${money(amount)} ${result.account.currency} ${input.type}`, input.reason);
    return { entryId, account: this.accounts.toDto(result.account) };
  }

  /** Remove bonus/credit bucket (credit is never withdrawable; admin can pull it). */
  async removeCredit(actor: Actor, accountId: string, input: { amount: string; reason: string }) {
    const amount = D(input.amount).negated();
    const { result } = await this.prisma.$transaction(async (tx) => {
      const result = await this.ledger.postInTx(tx, {
        accountId,
        type: 'adjustment',
        amount,
        reason: input.reason,
        refType: 'admin',
        refId: actor.id,
        actorId: actor.id,
        bucket: 'credit',
      });
      await tx.adminAudit.create({
        data: { actorId: actor.id, action: 'account.credit_remove', targetType: 'account', targetId: accountId, after: { amount: amount.toFixed(2), reason: input.reason }, ip: actor.ip },
      });
      return { result };
    });
    await this.afterMoneyChange(result.account.userId, result.account, `${money(amount)} credit removed`, input.reason);
    return { entryId: result.entryId, account: this.accounts.toDto(result.account) };
  }

  private async afterMoneyChange(userId: string, account: Parameters<AccountsService['snapshot']>[0], title: string, reason: string) {
    const snap = this.accounts.snapshot(account);
    this.ws.accountSnapshot(userId, snap);
    this.ws.notice(userId, { type: 'ledger', title: `Account ${account.loginCode}: ${title}`, body: reason, level: 'success' });
    this.ws.admin(WS_EVENTS.ADMIN_LEDGER, { ...snap, userId });
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { notifEmail: true } } } });
    if (u?.profile?.notifEmail) void this.mail.ledgerNotice(u.email, title, `${title}. Reason: ${reason}`).catch((e) => this.log.warn(e.message));
  }

  async accountLedger(accountId: string, page: number, limit: number) {
    const r = await this.ledger.list(accountId, page, limit);
    return { ...r, items: r.items.map(ledgerToDto) };
  }

  async listAccounts(q: { userId?: string; type?: 'demo' | 'live'; loginCode?: number }) {
    const rows = await this.prisma.tradingAccount.findMany({
      where: { ...(q.userId && { userId: q.userId }), ...(q.type && { type: q.type }), ...(q.loginCode && { loginCode: q.loginCode }) },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((a) => ({ ...this.accounts.toDto(a), userId: a.userId, userEmail: a.user.email }));
  }

  async audit(q: { page: number; limit: number; targetId?: string; actorId?: string }) {
    const where: Prisma.AdminAuditWhereInput = { ...(q.targetId && { targetId: q.targetId }), ...(q.actorId && { actorId: q.actorId }) };
    const [items, total] = await Promise.all([
      this.prisma.adminAudit.findMany({ where, include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
      this.prisma.adminAudit.count({ where }),
    ]);
    return { items, total, page: q.page, limit: q.limit };
  }
}
