import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type Tier } from '@prisma/client';
import type {
  AdminCreditInput,
  AdminDashboardDto,
  AdminDebitInput,
  AdminUserDetailDto,
  AdminUserRowDto,
  ClientNoteDto,
} from '@spova/shared';
import { WS_EVENTS } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { MailService } from '../../infra/mail.service';
import { RedisService } from '../../infra/redis.service';
import { SettingsService } from '../../infra/settings.service';
import { ActivityService } from '../../infra/activity.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from '../auth/auth.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { D, money } from '../../common/money';
import { ApiError } from '../../common/errors';
import { env } from '../../config/env';
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
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly activity: ActivityService,
  ) {}

  /** A client is "online" if they made an authenticated request within this window. */
  private static readonly ONLINE_WINDOW_MS = 3 * 60 * 1000;
  private isOnline(lastSeenAt: Date | null): boolean {
    return !!lastSeenAt && Date.now() - lastSeenAt.getTime() < AdminService.ONLINE_WINDOW_MS;
  }

  // ---------------------------------------------------------------- activity feed
  activityFeed(q: { page: number; limit: number; kind?: string; userId?: string }) {
    return this.activity.list(q);
  }
  async activityUnread(adminId: string) {
    return { count: await this.activity.unreadCount(adminId) };
  }
  async activityMarkRead(adminId: string) {
    await this.activity.markRead(adminId);
    return { ok: true };
  }

  // ---------------------------------------------------------------- dashboard

  async dashboard(): Promise<AdminDashboardDto> {
    const weekAgo = new Date(Date.now() - 7 * 86400 * 1000);
    const dayAgo = new Date(Date.now() - 86400 * 1000);
    const todayUtc = new Date(new Date().toISOString().slice(0, 10));
    const [clients, newClients7d, pendingKyc, pendingPayments, openPositions, demoSum, liveSum, openTickets, depToday, wdToday, pendDep, pendWd, active, exposureRows, feedStatus, platform, kycFrozen, dueSoonUsers, depTotal, wdTotal, manualTotal] = await Promise.all([
      this.prisma.user.count({ where: { role: 'client' } }),
      this.prisma.user.count({ where: { role: 'client', createdAt: { gte: weekAgo } } }),
      this.prisma.kycDocument.count({ where: { status: 'pending' } }),
      this.prisma.paymentRequest.count({ where: { status: 'pending' } }),
      this.prisma.position.count({ where: { status: 'open' } }),
      this.prisma.tradingAccount.aggregate({ _sum: { balance: true }, where: { type: 'demo' } }),
      this.prisma.tradingAccount.aggregate({ _sum: { balance: true }, where: { type: 'live' } }),
      this.prisma.ticket.count({ where: { status: 'open' } }),
      // deposits/withdrawals are counted from the LEDGER (live accounts) so admin manual deposits — not just client requests — are included
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { type: 'deposit', createdAt: { gte: todayUtc }, account: { type: 'live' } } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { type: 'withdraw', createdAt: { gte: todayUtc }, account: { type: 'live' } } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { kind: 'deposit', status: 'pending' } }),
      this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { kind: 'withdraw', status: 'pending' } }),
      this.prisma.session.findMany({ where: { createdAt: { gte: dayAgo }, revokedAt: null, user: { role: 'client' } }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.position.groupBy({ by: ['symbolId', 'side'], where: { status: 'open' }, _sum: { lots: true }, _count: { _all: true } }),
      this.redis.client.mget('feed:binance:status', 'feed:finnhub:status', 'feed:oanda:status', 'feed:synthetic:status'),
      this.settings.get<{ tradingHalt?: { enabled?: boolean } }>('platform', {}),
      this.prisma.user.count({ where: { role: 'client', status: 'active', kycFrozenAt: { not: null } } }),
      this.prisma.user.findMany({ where: { role: 'client', status: 'active', kycFrozenAt: null, kycDeadlineAt: { lte: new Date(Date.now() + 3 * 86400 * 1000) } }, select: { id: true } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { type: 'deposit', account: { type: 'live' } } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { type: 'withdraw', account: { type: 'live' } } }),
      // admin manual credits/bonuses only (refType 'admin'); excludes demo opening balances (refType 'system')
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { type: { in: ['credit', 'bonus'] }, refType: 'admin' } }),
    ]);
    const bySymbol = new Map<string, { buy: number; sell: number; positions: number }>();
    for (const r of exposureRows) {
      const e = bySymbol.get(r.symbolId) ?? { buy: 0, sell: 0, positions: 0 };
      e[r.side] += Number(r._sum.lots ?? 0);
      e.positions += r._count._all;
      bySymbol.set(r.symbolId, e);
    }
    const exposure = [...bySymbol.entries()]
      .map(([symbol, e]) => ({ symbol, buyLots: e.buy.toFixed(2), sellLots: e.sell.toFixed(2), netLots: (e.buy - e.sell).toFixed(2), positions: e.positions }))
      .sort((a, b) => Math.abs(Number(b.netLots)) - Math.abs(Number(a.netLots)))
      .slice(0, 8);
    const feeds = (['binance', 'finnhub', 'oanda', 'synthetic'] as const).map((source, i) => ({ source, status: (feedStatus[i] === 'up' || feedStatus[i] === 'down' ? feedStatus[i] : 'unknown') as 'up' | 'down' | 'unknown' }));
    return {
      clients,
      newClients7d,
      pendingKyc,
      pendingPayments,
      openPositions,
      demoBalanceTotal: money(demoSum._sum.balance),
      liveBalanceTotal: money(liveSum._sum.balance),
      openTickets,
      depositsToday: money(depToday._sum.amount),
      withdrawalsToday: money(D(wdToday._sum.amount ?? 0).negated()),
      depositsTotal: money(depTotal._sum.amount),
      withdrawalsTotal: money(D(wdTotal._sum.amount ?? 0).negated()),
      manualCreditsTotal: money(manualTotal._sum.amount),
      pendingDepositsTotal: money(pendDep._sum.amount),
      pendingWithdrawalsTotal: money(pendWd._sum.amount),
      activeClients24h: active.length,
      exposure,
      feeds,
      tradingHalt: !!platform.tradingHalt?.enabled,
      kycFrozen,
      kycDueSoon: await this.countIncomplete(dueSoonUsers.map((u) => u.id)),
    };
  }

  /** How many of these users still miss at least one of the four document groups. */
  private async countIncomplete(ids: string[]) {
    if (ids.length === 0) return 0;
    const docs = await this.prisma.kycDocument.groupBy({ by: ['userId', 'group'], where: { userId: { in: ids }, status: { not: 'rejected' } } });
    const per = new Map<string, number>();
    for (const d of docs) per.set(d.userId, (per.get(d.userId) ?? 0) + 1);
    return ids.filter((id) => (per.get(id) ?? 0) < 4).length;
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
        include: { profile: true, accounts: { select: { id: true, balance: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    // open-position counts for the page, in one grouped query
    const acctIds = rows.flatMap((u) => u.accounts.map((a) => a.id));
    const openGroups = acctIds.length ? await this.prisma.position.groupBy({ by: ['accountId'], where: { accountId: { in: acctIds }, status: 'open' }, _count: { _all: true } }) : [];
    const openByAcct = new Map(openGroups.map((g) => [g.accountId, g._count._all]));
    const openTradesOf = (u: (typeof rows)[number]) => u.accounts.reduce((n, a) => n + (openByAcct.get(a.id) ?? 0), 0);
    const items: AdminUserRowDto[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      kycDeadlineAt: u.kycDeadlineAt?.toISOString() ?? null,
      kycFrozen: !!u.kycFrozenAt,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      countryCode: u.profile?.countryCode ?? null,
      kyc: { poi: u.kycPoi, por: u.kycPor },
      accountsCount: u.accounts.length,
      totalBalance: money(u.accounts.reduce((s, a) => s.plus(D(a.balance)), D(0))),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      online: this.isOnline(u.lastSeenAt),
      openTrades: openTradesOf(u),
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  async getUser(id: string): Promise<AdminUserDetailDto> {
    const u = await this.prisma.user.findUnique({ where: { id }, include: { profile: true, accounts: { orderBy: { createdAt: 'asc' } } } });
    if (!u) throw ApiError.notFound('user_not_found', 'User not found');
    const me = await this.auth.toMe(u);
    const acctIds = u.accounts.map((a) => a.id);
    const [open, closed, vol, pnl, deps, wdrs, pendingPayments, openTickets, manual] = await Promise.all([
      this.prisma.position.count({ where: { accountId: { in: acctIds }, status: 'open' } }),
      this.prisma.position.count({ where: { accountId: { in: acctIds }, status: 'closed' } }),
      this.prisma.position.aggregate({ _sum: { lots: true }, where: { accountId: { in: acctIds } } }),
      this.prisma.position.aggregate({ _sum: { realizedPnl: true }, where: { accountId: { in: acctIds }, status: 'closed' } }),
      // from the ledger so admin manual deposits/debits count too (not only approved client requests)
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { accountId: { in: acctIds }, type: 'deposit' } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { accountId: { in: acctIds }, type: 'withdraw' } }),
      this.prisma.paymentRequest.count({ where: { userId: id, status: 'pending' } }),
      this.prisma.ticket.count({ where: { userId: id, status: { not: 'closed' } } }),
      this.prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { accountId: { in: acctIds }, type: { in: ['credit', 'bonus'] }, refType: 'admin' } }),
    ]);
    const stats = {
      openTrades: open,
      closedTrades: closed,
      totalVolumeLots: D(vol._sum.lots ?? 0).toFixed(2),
      realizedPnl: money(pnl._sum.realizedPnl ?? 0),
      depositsApproved: money(deps._sum.amount ?? 0),
      withdrawalsApproved: money(D(wdrs._sum.amount ?? 0).negated()),
      manualCredits: money(manual._sum.amount ?? 0),
      pendingPayments,
      openTickets,
    };
    const comments = await this.listNotes(id);
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      kycDeadlineAt: u.kycDeadlineAt?.toISOString() ?? null,
      kycFrozen: !!u.kycFrozenAt,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      countryCode: u.profile?.countryCode ?? null,
      kyc: { poi: u.kycPoi, por: u.kycPor },
      accountsCount: u.accounts.length,
      totalBalance: money(u.accounts.reduce((s, a) => s.plus(D(a.balance)), D(0))),
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      online: this.isOnline(u.lastSeenAt),
      openTrades: open,
      lastLoginIp: u.lastLoginIp,
      notes: u.adminNotes,
      comments,
      profile: me.profile,
      accounts: await Promise.all(u.accounts.map((a) => this.accounts.toDto(a))),
      stats,
    };
  }

  // ---------------------------------------------------------------- client comment log (agent call notes)

  private noteToDto(n: { id: string; body: string; authorId: string; createdAt: Date; updatedAt: Date; author?: { profile: { firstName: string; lastName: string } | null; email: string } | null }): ClientNoteDto {
    const name = n.author?.profile ? `${n.author.profile.firstName} ${n.author.profile.lastName}`.trim() : (n.author?.email ?? 'staff');
    return { id: n.id, body: n.body, authorId: n.authorId, authorName: name, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() };
  }

  /** All comments on a client's file, newest first. */
  async listNotes(userId: string): Promise<ClientNoteDto[]> {
    const rows = await this.prisma.clientNote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    });
    return rows.map((n) => this.noteToDto(n));
  }

  async addNote(actor: Actor, userId: string, body: string): Promise<ClientNoteDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw ApiError.notFound('user_not_found', 'User not found');
    const row = await this.prisma.clientNote.create({
      data: { userId, authorId: actor.id, body },
      include: { author: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    });
    return this.noteToDto(row);
  }

  async editNote(actor: Actor, noteId: string, body: string): Promise<ClientNoteDto> {
    const existing = await this.prisma.clientNote.findUnique({ where: { id: noteId }, select: { authorId: true } });
    if (!existing) throw ApiError.notFound('note_not_found', 'Comment not found');
    if (existing.authorId !== actor.id && actor.role !== 'superadmin') throw ApiError.forbidden('not_author', 'Only the author or a superadmin can edit this comment');
    const row = await this.prisma.clientNote.update({
      where: { id: noteId },
      data: { body },
      include: { author: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
    });
    return this.noteToDto(row);
  }

  async deleteNote(actor: Actor, noteId: string): Promise<{ id: string }> {
    const existing = await this.prisma.clientNote.findUnique({ where: { id: noteId }, select: { authorId: true } });
    if (!existing) throw ApiError.notFound('note_not_found', 'Comment not found');
    if (existing.authorId !== actor.id && actor.role !== 'superadmin') throw ApiError.forbidden('not_author', 'Only the author or a superadmin can delete this comment');
    await this.prisma.clientNote.delete({ where: { id: noteId } });
    return { id: noteId };
  }

  async updateUser(actor: Actor, id: string, patch: { status?: 'active' | 'frozen' | 'closed'; notes?: string | null; kycDeadlineAt?: string }) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: { status: true, adminNotes: true, role: true } });
    if (!before) throw ApiError.notFound('user_not_found', 'User not found');
    if (before.role !== 'client' && actor.role !== 'superadmin') throw ApiError.forbidden('staff_protected', 'Only superadmin can modify staff');

    const after = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.notes !== undefined && { adminNotes: patch.notes }),
          ...(patch.kycDeadlineAt !== undefined && { kycDeadlineAt: new Date(patch.kycDeadlineAt), kycReminderSentAt: null }),
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

  /** Admin opens an account for a client (no self-serve limit). */
  async createAccount(actor: Actor, userId: string, input: { type: 'demo' | 'live'; tier?: Tier; leverage?: number }) {
    const dto = await this.accounts.adminCreate(userId, input.type, { tier: input.tier, leverage: input.leverage });
    await this.prisma.adminAudit.create({ data: { actorId: actor.id, action: 'account.create', targetType: 'account', targetId: dto.id, before: {}, after: { type: dto.type, tier: dto.tier, loginCode: dto.loginCode }, ip: actor.ip } });
    void this.activity.record({ userId, kind: 'account_open', title: `Admin opened a ${input.type} account`, detail: `#${dto.loginCode} · ${dto.tier}`, meta: { loginCode: dto.loginCode, type: input.type } });
    return dto;
  }

  /** Hard-delete an account and all its records. Demo: any admin. Live: superadmin only (it destroys the money trail). */
  async deleteAccount(actor: Actor, accountId: string) {
    const acc = await this.prisma.tradingAccount.findUnique({ where: { id: accountId }, select: { id: true, type: true, userId: true, loginCode: true, balance: true } });
    if (!acc) throw ApiError.notFound('account_not_found', 'Account not found');
    if (acc.type === 'live' && actor.role !== 'superadmin') throw ApiError.forbidden('superadmin_required', 'Only a superadmin can delete a live account');
    await this.prisma.$transaction(async (tx) => {
      await tx.positionClose.deleteMany({ where: { position: { accountId } } });
      await tx.position.deleteMany({ where: { accountId } });
      await tx.order.deleteMany({ where: { accountId } });
      // ledger_entries is append-only (a BEFORE DELETE trigger); lift it only for this account's rows inside the tx, then restore it
      await tx.$executeRawUnsafe('ALTER TABLE ledger_entries DISABLE TRIGGER ledger_entries_append_only');
      await tx.ledgerEntry.deleteMany({ where: { accountId } });
      await tx.$executeRawUnsafe('ALTER TABLE ledger_entries ENABLE TRIGGER ledger_entries_append_only');
      await tx.paymentRequest.deleteMany({ where: { accountId } });
      await tx.statementExport.deleteMany({ where: { accountId } });
      await tx.tradingAccount.delete({ where: { id: accountId } });
      await tx.adminAudit.create({ data: { actorId: actor.id, action: 'account.delete', targetType: 'account', targetId: accountId, before: { type: acc.type, loginCode: acc.loginCode, balance: money(acc.balance) }, after: {}, ip: actor.ip } });
    });
    void this.activity.record({ userId: acc.userId, kind: 'account_delete', title: `Admin deleted a ${acc.type} account`, detail: `#${acc.loginCode}`, meta: { loginCode: acc.loginCode, type: acc.type } });
    return { id: accountId };
  }

  async updateAccount(
    actor: Actor,
    accountId: string,
    patch: { leverage?: number; tier?: 'classic' | 'silver' | 'gold' | 'platinum' | 'vip'; status?: 'enabled' | 'disabled' | 'readonly'; tradingBlocked?: boolean; swapFree?: boolean; usdRate?: number | null },
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
          before: { leverage: before.leverage, tier: before.tier, status: before.status, tradingBlocked: before.tradingBlocked, swapFree: before.swapFree },
          after: { leverage: a.leverage, tier: a.tier, status: a.status, tradingBlocked: a.tradingBlocked, swapFree: a.swapFree },
          ip: actor.ip,
        },
      });
      return a;
    });

    this.ws.accountSnapshot(after.userId, await this.accounts.snapshot(after));
    if (patch.tradingBlocked === true) {
      this.ws.notice(after.userId, { type: 'trading_blocked', title: 'Trading disabled', body: `Trading on account ${after.loginCode} has been disabled by the broker.`, level: 'warning' });
    }
    return this.accounts.toDto(after);
  }

  /** POST /admin/accounts/:id/credit  {amount, reason, type: deposit|credit|bonus} */
  async credit(actor: Actor, accountId: string, input: AdminCreditInput) {
    const amount = D(input.amount);
    const bucket = input.type === 'bonus' || input.type === 'credit' ? 'credit' : 'balance';

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
    void this.activity.record({ userId: result.account.userId, kind: input.type === 'deposit' ? 'deposit' : 'credit', title: `Admin ${input.type}`, detail: `+${money(amount)} ${result.account.currency} · ${input.reason}`, meta: { amount: money(amount), type: input.type, loginCode: result.account.loginCode, manual: true } });
    const cu = await this.prisma.user.findUnique({ where: { id: result.account.userId }, select: { email: true, profile: { select: { firstName: true, notifEmail: true } } } });
    if (cu?.profile?.notifEmail !== false) void this.mail.creditAdded(cu!.email, cu!.profile?.firstName ?? '', money(amount), result.account.currency, result.account.loginCode, input.type).catch((e) => this.log.warn(e.message));
    return { entryId, account: await this.accounts.toDto(result.account) };
  }

  /** Admin button: email the client a prompt to fund their account. */
  async sendDepositEmail(actor: Actor, userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, role: true, profile: { select: { firstName: true } } } });
    if (user.role !== 'client') throw ApiError.badRequest('not_a_client', 'Deposit emails go to clients only');
    const web = (env.WEB_ORIGIN || '').split(',')[0] || 'https://www.zerventa.com';
    const token = await this.auth.createDepositLinkToken(userId);
    const link = `${web}/deposit-link?token=${encodeURIComponent(token)}`;
    await this.mail.depositInvite(user.email, user.profile?.firstName ?? '', link);
    await this.prisma.adminAudit.create({ data: { actorId: actor.id, action: 'user.deposit_email', targetType: 'user', targetId: userId, ip: actor.ip } });
    return { sent: true };
  }

  /** POST /admin/accounts/:id/debit  {amount, reason, type: withdraw|debit|fee, force?} */
  async debit(actor: Actor, accountId: string, input: AdminDebitInput) {
    const amount = D(input.amount).negated();
    const force = input.force && actor.role === 'superadmin';
    // 'remove_credit' claws back non-withdrawable credit/bonus: it hits the CREDIT bucket (ledger type adjustment), not the cash balance
    const removeCredit = input.type === 'remove_credit';

    const { result, entryId } = await this.prisma.$transaction(async (tx) => {
      const result = await this.ledger.postInTx(tx, {
        accountId,
        type: removeCredit ? 'adjustment' : (input.type as 'withdraw' | 'debit' | 'fee'),
        amount,
        reason: input.reason,
        refType: 'admin',
        refId: actor.id,
        actorId: actor.id,
        bucket: removeCredit ? 'credit' : 'balance',
        allowNegative: removeCredit ? false : force,
      });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: `account.${input.type}`,
          targetType: 'account',
          targetId: accountId,
          before: removeCredit ? { credit: D(result.account.credit).minus(amount).toFixed(2) } : { balance: result.balanceAfter.minus(amount).toFixed(2) },
          after: { balance: money(result.account.balance), credit: money(result.account.credit), amount: amount.toFixed(2), reason: input.reason, force: !!force },
          ip: actor.ip,
        },
      });
      return { result, entryId: result.entryId };
    });

    await this.afterMoneyChange(result.account.userId, result.account, `${money(amount)} ${result.account.currency} ${removeCredit ? 'credit removed' : input.type}`, input.reason);
    void this.activity.record({ userId: result.account.userId, kind: removeCredit ? 'credit_removed' : input.type === 'withdraw' ? 'withdraw' : 'debit', title: `Admin ${removeCredit ? 'credit removal' : input.type}`, detail: `${money(amount)} ${result.account.currency} · ${input.reason}`, meta: { amount: money(amount), type: removeCredit ? 'remove_credit' : input.type, loginCode: result.account.loginCode, manual: true } });
    return { entryId, account: await this.accounts.toDto(result.account) };
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
    void this.activity.record({ userId: result.account.userId, kind: 'credit_removed', title: 'Admin credit removal', detail: `${money(amount)} · ${input.reason}`, meta: { amount: money(amount), loginCode: result.account.loginCode, manual: true } });
    return { entryId: result.entryId, account: await this.accounts.toDto(result.account) };
  }

  private async afterMoneyChange(userId: string, account: Parameters<AccountsService['snapshot']>[0], title: string, reason: string) {
    const snap = await this.accounts.snapshot(account);
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
    return Promise.all(rows.map(async (a) => ({ ...(await this.accounts.toDto(a)), userId: a.userId, userEmail: a.user.email })));
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
