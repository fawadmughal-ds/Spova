import { Injectable, Logger } from '@nestjs/common';
import { PaymentKind, PaymentRequest, PaymentStatus, Prisma, TradingAccount } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  DEFAULT_DEPOSIT_CHANNELS,
  KYC_MAX_BYTES,
  KYC_MIME_TYPES,
  PAYMENT_METHODS,
  WS_EVENTS,
  depositChannelPublic,
  depositChannelsSchema,
  depositEnabled,
  type DepositChannels,
  type AdminPaymentRowDto,
  type DepositRequestInput,
  type Paginated,
  type PaymentDecisionInput,
  type PaymentMethodDto,
  type PaymentRequestDto,
  type WithdrawRequestInput,
  type WsPaymentStatus,
} from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { MailService } from '../../infra/mail.service';
import { RedisService } from '../../infra/redis.service';
import { StorageService } from '../../infra/storage.service';
import { SettingsService } from '../../infra/settings.service';
import { EXT, sniff } from '../kyc/kyc.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { env } from '../../config/env';
import { D, money } from '../../common/money';
import { ApiError } from '../../common/errors';

interface Actor {
  id: string;
  ip?: string;
}

type PaymentWithAccount = PaymentRequest & { account: Pick<TradingAccount, 'loginCode'> };

export const paymentToDto = (p: PaymentWithAccount): PaymentRequestDto => ({
  id: p.id,
  accountId: p.accountId,
  accountLogin: p.account.loginCode,
  kind: p.kind,
  amount: money(p.amount),
  currency: p.currency,
  method: p.method,
  destination: (p.destination as { label: string; details: string } | null) ?? null,
  reference: p.reference,
  proof: p.proofKey ? { name: p.proofName ?? 'proof', mime: p.proofMime ?? 'application/octet-stream' } : null,
  status: p.status,
  adminNote: p.adminNote,
  decidedAt: p.decidedAt?.toISOString() ?? null,
  ledgerEntryId: p.ledgerEntryId,
  createdAt: p.createdAt.toISOString(),
});

const methodOf = (id: string) => PAYMENT_METHODS.find((m) => m.id === id);
export const DEPOSIT_CHANNELS_KEY = 'deposit_channels';

/** Deposit / withdrawal request queue (ARCHITECTURE §07). Money moves only when an admin approves, through LedgerService. */
@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly ws: RealtimeGateway,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  /** Admin-edited deposit channels, falling back to the defaults field by field. */
  async channels(): Promise<DepositChannels> {
    const stored = await this.settings.get<Partial<DepositChannels>>(DEPOSIT_CHANNELS_KEY, {});
    const merged = Object.fromEntries(Object.entries(DEFAULT_DEPOSIT_CHANNELS).map(([k, v]) => [k, { ...v, ...(stored[k as keyof DepositChannels] ?? {}) }]));
    const parsed = depositChannelsSchema.safeParse(merged);
    return parsed.success ? parsed.data : DEFAULT_DEPOSIT_CHANNELS;
  }

  async setChannels(actor: Actor, input: DepositChannels) {
    const before = await this.channels();
    await this.settings.set(DEPOSIT_CHANNELS_KEY, input, actor.id);
    await this.prisma.adminAudit.create({ data: { actorId: actor.id, action: 'payments.channels.update', targetType: 'app_setting', before, after: input, ip: actor.ip } });
    return input;
  }

  /** Methods with the deposit side switched by the admin's channels and the public "pay to" details attached. */
  async methods(): Promise<PaymentMethodDto[]> {
    const cfg = await this.channels();
    return PAYMENT_METHODS.map((m) => {
      const canDeposit = (m.kinds as readonly string[]).includes('deposit');
      const depositOn = canDeposit && depositEnabled(m.id, cfg);
      const kinds = [...m.kinds].filter((k) => k !== 'deposit' || depositOn) as PaymentMethodDto['kinds'];
      const withdrawOn = kinds.includes('withdraw') && m.enabled;
      return { ...m, kinds, enabled: depositOn || withdrawOn, ...(depositOn && { deposit: depositChannelPublic(m.id, cfg, env.BRAND_NAME) }) };
    });
  }

  // ---------------------------------------------------------------- client

  async list(userId: string, q: { kind?: PaymentKind; status?: PaymentStatus; page: number; limit: number }): Promise<Paginated<PaymentRequestDto>> {
    const where: Prisma.PaymentRequestWhereInput = { userId, ...(q.kind && { kind: q.kind }), ...(q.status && { status: q.status }) };
    const [total, rows] = await Promise.all([
      this.prisma.paymentRequest.count({ where }),
      this.prisma.paymentRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit, include: { account: { select: { loginCode: true } } } }),
    ]);
    return { items: rows.map(paymentToDto), total, page: q.page, limit: q.limit };
  }

  private async guardUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, email: true, kycPoi: true, kycPor: true } });
    if (user.status !== 'active') throw ApiError.forbidden('account_frozen', 'Your account is restricted. Contact support.');
    if (!(await this.redis.allow(`payments:${userId}`, 20, 3600))) throw ApiError.tooMany('Too many requests. Try again later.');
    return user;
  }

  private async liveAccount(userId: string, accountId: string) {
    const acc = await this.accounts.getOwned(userId, accountId);
    if (acc.type !== 'live') throw ApiError.unprocessable('demo_account', 'Demo accounts use virtual funds. Open a live account to deposit or withdraw real money.');
    if (acc.status !== 'enabled') throw ApiError.forbidden('account_disabled', `This account is ${acc.status}. Contact support.`);
    return acc;
  }

  async deposit(userId: string, input: DepositRequestInput) {
    const user = await this.guardUser(userId);
    const acc = await this.liveAccount(userId, input.accountId);
    const method = methodOf(input.method);
    const cfg = await this.channels();
    if (!method || !(method.kinds as readonly string[]).includes('deposit') || !depositEnabled(method.id, cfg)) throw ApiError.badRequest('method_unavailable', 'This deposit method is not available');
    const amount = D(input.amount);
    if (amount.lt(method.minDeposit)) throw ApiError.badRequest('amount_min', `Minimum deposit by ${method.label} is ${method.minDeposit} USD`);
    if (amount.gt(method.maxDeposit)) throw ApiError.badRequest('amount_max', `Maximum deposit by ${method.label} is ${method.maxDeposit} USD`);

    const row = await this.prisma.paymentRequest.create({
      data: { userId, accountId: acc.id, kind: 'deposit', amount: amount.toFixed(2), currency: acc.currency, method: input.method, reference: input.reference ?? null },
      include: { account: { select: { loginCode: true } } },
    });
    this.afterNew(row, user.email);
    return paymentToDto(row);
  }

  async withdraw(userId: string, input: WithdrawRequestInput) {
    const user = await this.guardUser(userId);
    if (env.KYC_REQUIRED_FOR_WITHDRAW && !(user.kycPoi && user.kycPor)) {
      throw ApiError.forbidden('kyc_required', 'Complete identity and address verification before withdrawing');
    }
    const acc = await this.liveAccount(userId, input.accountId);
    const method = methodOf(input.method);
    if (!method || !method.enabled || !(method.kinds as readonly string[]).includes('withdraw')) throw ApiError.badRequest('method_unavailable', 'This withdrawal method is not available');
    const amount = D(input.amount);
    if (amount.lt(method.minWithdraw)) throw ApiError.badRequest('amount_min', `Minimum withdrawal by ${method.label} is ${method.minWithdraw} USD`);
    if (amount.gt(method.maxWithdraw)) throw ApiError.badRequest('amount_max', `Maximum withdrawal by ${method.label} is ${method.maxWithdraw} USD`);

    // v1: no hold. Pending withdrawals count against what can be requested, and the amount is re-checked at approval.
    const snap = await this.accounts.snapshot(acc);
    const pending = await this.prisma.paymentRequest.aggregate({ _sum: { amount: true }, where: { accountId: acc.id, kind: 'withdraw', status: 'pending' } });
    const available = Decimal_min(D(acc.balance), D(snap.freeMargin)).minus(D(pending._sum.amount));
    if (amount.gt(available)) {
      throw ApiError.unprocessable('insufficient_funds', 'Amount exceeds what can be withdrawn', { available: money(available.lt(0) ? 0 : available), balance: money(acc.balance), freeMargin: snap.freeMargin, pendingWithdrawals: money(pending._sum.amount) });
    }

    const row = await this.prisma.paymentRequest.create({
      data: { userId, accountId: acc.id, kind: 'withdraw', amount: amount.toFixed(2), currency: acc.currency, method: input.method, destination: input.destination, reference: input.reason ?? null },
      include: { account: { select: { loginCode: true } } },
    });
    this.afterNew(row, user.email);
    return paymentToDto(row);
  }

  /** Payment slip / screenshot for a pending request (replaces an earlier one). Same file rules as KYC. */
  async attachProof(userId: string, id: string, file: { buffer: Buffer; originalname: string; size: number }) {
    if (!(await this.redis.allow(`payments:proof:${userId}`, 30, 3600))) throw ApiError.tooMany('Too many uploads. Try again later.');
    if (file.size > KYC_MAX_BYTES) throw ApiError.badRequest('file_too_large', 'File is larger than 10 MB');
    const sniffed = sniff(file.buffer);
    if (!sniffed || !(KYC_MIME_TYPES as readonly string[]).includes(sniffed)) throw ApiError.badRequest('file_type', 'Only JPG, PNG, WEBP or PDF files are accepted');
    const row = await this.prisma.paymentRequest.findFirst({ where: { id, userId } });
    if (!row) throw ApiError.notFound('payment_not_found', 'Request not found');
    if (row.status !== 'pending') throw ApiError.conflict('not_pending', `Request is already ${row.status}`);
    const key = `proof/${userId}/${randomUUID()}.${EXT[sniffed]}`;
    await this.storage.put(key, file.buffer, sniffed);
    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: { proofKey: key, proofName: file.originalname.slice(0, 200) || `proof.${EXT[sniffed]}`, proofMime: sniffed },
      include: { account: { select: { loginCode: true } } },
    });
    this.ws.admin(WS_EVENTS.ADMIN_PAYMENT_NEW, { id: updated.id, userId, kind: updated.kind, amount: money(updated.amount), method: updated.method, email: '', createdAt: updated.createdAt.toISOString(), proof: true });
    return paymentToDto(updated);
  }

  /** Owner or admin may read the slip; it streams through the API so storage stays private. */
  async proof(id: string, requester: { id: string; isAdmin: boolean }) {
    const row = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!row || (!requester.isAdmin && row.userId !== requester.id) || !row.proofKey) throw ApiError.notFound('proof_not_found', 'No payment proof on this request');
    const stored = await this.storage.get(row.proofKey);
    return { name: row.proofName ?? 'proof', mime: row.proofMime ?? 'application/octet-stream', stored };
  }

  /** Clients may withdraw a request only while it is still pending. */
  async cancel(userId: string, id: string) {
    const row = await this.prisma.paymentRequest.findFirst({ where: { id, userId }, include: { account: { select: { loginCode: true } } } });
    if (!row) throw ApiError.notFound('payment_not_found', 'Request not found');
    if (row.status !== 'pending') throw ApiError.conflict('not_pending', `Request is already ${row.status}`);
    const updated = await this.prisma.paymentRequest.update({ where: { id }, data: { status: 'cancelled', decidedAt: new Date() }, include: { account: { select: { loginCode: true } } } });
    return paymentToDto(updated);
  }

  private afterNew(row: PaymentWithAccount, email: string) {
    this.ws.admin(WS_EVENTS.ADMIN_PAYMENT_NEW, { id: row.id, userId: row.userId, kind: row.kind, amount: money(row.amount), method: row.method, email, createdAt: row.createdAt.toISOString() });
    void this.mail.adminAlert(`New ${row.kind} request`, `${email} requested a ${row.kind} of ${money(row.amount)} ${row.currency} by ${row.method} on account ${row.account.loginCode}.`).catch((e) => this.log.warn(e.message));
  }

  // ---------------------------------------------------------------- admin

  async queue(q: { status?: PaymentStatus; kind?: PaymentKind; userId?: string; page: number; limit: number }): Promise<Paginated<AdminPaymentRowDto>> {
    const where: Prisma.PaymentRequestWhereInput = { ...(q.status && { status: q.status }), ...(q.kind && { kind: q.kind }), ...(q.userId && { userId: q.userId }) };
    const [total, rows] = await Promise.all([
      this.prisma.paymentRequest.count({ where }),
      this.prisma.paymentRequest.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { account: true, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
      }),
    ]);
    const items = await Promise.all(
      rows.map(async (r) => {
        const snap = await this.accounts.snapshot(r.account);
        return {
          ...paymentToDto(r),
          user: { id: r.user.id, email: r.user.email, firstName: r.user.profile?.firstName ?? null, lastName: r.user.profile?.lastName ?? null },
          account: { type: r.account.type, balance: snap.balance, freeMargin: snap.freeMargin },
        };
      }),
    );
    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  /**
   * Approve = one transaction: lock the request, post the ledger entry (which locks the account), mark the request, audit.
   * Decline = status + note, no money moves.
   */
  async decide(actor: Actor, id: string, input: PaymentDecisionInput) {
    const { row, account } = await this.prisma.$transaction(async (tx) => {
      // row lock first (raw rows come back snake_case, so re-read through Prisma for the typed shape)
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payment_requests WHERE id = ${id}::uuid FOR UPDATE`;
      if (!locked[0]) throw ApiError.notFound('payment_not_found', 'Request not found');
      const req = await tx.paymentRequest.findUniqueOrThrow({ where: { id } });
      if (req.status !== 'pending') throw ApiError.conflict('not_pending', `Request is already ${req.status}`);

      let ledgerEntryId: string | null = null;
      let account: TradingAccount | null = null;
      if (input.status === 'approved') {
        const amount = D(req.amount);
        const signed = req.kind === 'deposit' ? amount : amount.negated();
        const result = await this.ledger.postInTx(tx, {
          accountId: req.accountId,
          type: req.kind === 'deposit' ? 'deposit' : 'withdraw',
          amount: signed,
          reason: `${req.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} via ${req.method}${req.reference ? ` (${req.reference})` : ''}`,
          refType: 'payment_request',
          refId: req.id,
          actorId: actor.id,
        });
        ledgerEntryId = result.entryId;
        account = result.account;
      }

      const row = await tx.paymentRequest.update({
        where: { id },
        data: { status: input.status, adminNote: input.note ?? null, decidedBy: actor.id, decidedAt: new Date(), ledgerEntryId },
        include: { account: { select: { loginCode: true } } },
      });
      await tx.adminAudit.create({
        data: {
          actorId: actor.id,
          action: `payment.${input.status === 'approved' ? 'approve' : 'decline'}`,
          targetType: 'payment_request',
          targetId: id,
          before: { status: 'pending' },
          after: { status: input.status, kind: req.kind, amount: money(req.amount), note: input.note ?? null, ledgerEntryId },
          ip: actor.ip,
        },
      });
      await tx.notification.create({
        data: {
          userId: req.userId,
          type: 'payment',
          title: `${req.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${input.status}`,
          body: `${money(req.amount)} ${req.currency} by ${req.method}${input.note ? ` - ${input.note}` : ''}`,
        },
      });
      return { row, account };
    });

    if (account) {
      const snap = await this.accounts.snapshot(account);
      this.ws.accountSnapshot(row.userId, snap);
      this.ws.admin(WS_EVENTS.ADMIN_LEDGER, { ...snap, userId: row.userId });
    }
    const payload: WsPaymentStatus = { paymentId: row.id, kind: row.kind, status: row.status, ...(input.note && { note: input.note }) };
    this.ws.user(row.userId, WS_EVENTS.PAYMENT_STATUS, payload);
    this.ws.notice(row.userId, {
      type: 'payment',
      title: `${row.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} ${row.status}`,
      body: `${money(row.amount)} ${row.currency} on account ${row.account.loginCode}${input.note ? ` - ${input.note}` : ''}`,
      level: row.status === 'approved' ? 'success' : 'warning',
    });
    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { email: true, profile: { select: { notifEmail: true } } } });
    if (user?.profile?.notifEmail) void this.mail.paymentResult(user.email, row.kind, money(row.amount), input.status, input.note).catch((e) => this.log.warn(e.message));
    return paymentToDto(row);
  }
}

const Decimal_min = (a: ReturnType<typeof D>, b: ReturnType<typeof D>) => (a.lt(b) ? a : b);
