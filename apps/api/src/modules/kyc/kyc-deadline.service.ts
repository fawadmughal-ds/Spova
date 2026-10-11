import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { KYC_GROUPS, type KycDeadlineRowDto, type KycGroup } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { MailService } from '../../infra/mail.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ApiError } from '../../common/errors';

export const KYC_WINDOW_DAYS = 15;
export const KYC_REMINDER_DAYS = 3;
const DAY = 86_400_000;
const SWEEP_MS = 60 * 60 * 1000;

interface Actor {
  id: string;
  ip?: string;
}

/**
 * Document deadline (sign-up + 15 days). Every client must upload one document in each of the four groups.
 * 3 days before the deadline: email + in-app reminder. At the deadline: trading on every account is blocked
 * and the user is marked frozen. Uploading the missing documents unfreezes automatically; an admin can
 * unfreeze (and extend) from the back office. The hourly sweep runs on one API instance at a time (Redis lock).
 */
@Injectable()
export class KycDeadlineService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('KycDeadline');
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly ws: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweepLocked().catch((e) => this.log.warn({ err: (e as Error).message }, 'sweep failed')), SWEEP_MS);
    this.timer.unref();
    setTimeout(() => void this.sweepLocked().catch(() => undefined), 15_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  static daysLeft(deadline: Date, now = Date.now()) {
    return Math.ceil((deadline.getTime() - now) / DAY);
  }

  /** Groups with at least one document that was not rejected. */
  async uploadedGroups(userId: string): Promise<KycGroup[]> {
    const rows = await this.prisma.kycDocument.findMany({ where: { userId, status: { not: 'rejected' } }, select: { group: true }, distinct: ['group'] });
    return rows.map((r) => r.group);
  }

  async isComplete(userId: string) {
    return (await this.uploadedGroups(userId)).length >= KYC_GROUPS.length;
  }

  private async sweepLocked() {
    const got = await this.redis.client.set('lock:kyc-sweep', '1', 'EX', 600, 'NX');
    if (!got) return;
    try {
      await this.sweep();
    } finally {
      await this.redis.client.del('lock:kyc-sweep').catch(() => undefined);
    }
  }

  /** Reminders and freezes that are due now. Returns what it did (also used by the admin "run now" button and tests). */
  async sweep(now = new Date()) {
    const soon = new Date(now.getTime() + KYC_REMINDER_DAYS * DAY);
    const candidates = await this.prisma.user.findMany({
      where: { role: 'client', status: 'active', kycFrozenAt: null, kycDeadlineAt: { not: null, lte: soon } },
      select: { id: true, email: true, kycDeadlineAt: true, kycReminderSentAt: true, profile: { select: { firstName: true, notifEmail: true } } },
    });
    let reminded = 0;
    let frozen = 0;
    for (const u of candidates) {
      if (await this.isComplete(u.id)) continue;
      const deadline = u.kycDeadlineAt!;
      if (deadline.getTime() <= now.getTime()) {
        await this.freeze(u.id, u.email, u.profile?.firstName ?? '', !!u.profile?.notifEmail);
        frozen++;
      } else {
        // remind once per day while 3, 2 or 1 days remain (kycReminderSentAt holds the last reminder's date)
        const days = Math.max(1, KycDeadlineService.daysLeft(deadline, now.getTime()));
        const lastDay = u.kycReminderSentAt ? u.kycReminderSentAt.toISOString().slice(0, 10) : null;
        const today = now.toISOString().slice(0, 10);
        if (days <= KYC_REMINDER_DAYS && lastDay !== today) {
          await this.prisma.user.update({ where: { id: u.id }, data: { kycReminderSentAt: now } });
          await this.prisma.notification.create({ data: { userId: u.id, type: 'kyc', title: `${days} day${days === 1 ? '' : 's'} left to upload your documents`, body: 'Upload proof of identity, proof of residence, a payment document and any other requested document, or trading will be paused.' } });
          this.ws.notice(u.id, { type: 'kyc', title: `${days} day${days === 1 ? '' : 's'} left to upload your documents`, body: 'Go to Documents to finish verification before the deadline.', level: 'warning' });
          if (u.profile?.notifEmail !== false) void this.mail.kycReminder(u.email, u.profile?.firstName ?? '', days, deadline).catch((e) => this.log.warn(e.message));
          reminded++;
        }
      }
    }
    if (reminded || frozen) this.log.warn({ reminded, frozen }, 'kyc deadline sweep');
    return { checked: candidates.length, reminded, frozen };
  }

  private async freeze(userId: string, email: string, firstName: string, emailOk: boolean) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { kycFrozenAt: new Date() } }),
      this.prisma.tradingAccount.updateMany({ where: { userId }, data: { tradingBlocked: true } }),
      this.prisma.notification.create({ data: { userId, type: 'kyc', title: 'Account frozen: documents missing', body: 'The 15-day window to upload your documents has passed. Upload them in Documents to resume trading.' } }),
    ]);
    this.ws.notice(userId, { type: 'kyc', title: 'Account frozen', body: 'Upload all required documents to resume trading.', level: 'danger' });
    this.ws.user(userId, 'kyc:frozen', { frozen: true });
    this.ws.admin('admin:kyc:frozen', { userId, email });
    if (emailOk) void this.mail.kycFrozen(email, firstName).catch((e) => this.log.warn(e.message));
  }

  /** Called after every upload: the moment all four groups are present, trading resumes. */
  async unfreezeIfComplete(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { kycFrozenAt: true, email: true, profile: { select: { firstName: true, notifEmail: true } } } });
    if (!user?.kycFrozenAt) return false;
    if (!(await this.isComplete(userId))) return false;
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { kycFrozenAt: null } }),
      this.prisma.tradingAccount.updateMany({ where: { userId }, data: { tradingBlocked: false } }),
      this.prisma.notification.create({ data: { userId, type: 'kyc', title: 'Documents received: trading resumed', body: 'Thank you. Your documents are with the compliance team; trading is open again.' } }),
    ]);
    this.ws.notice(userId, { type: 'kyc', title: 'Trading resumed', body: 'All documents received.', level: 'success' });
    this.ws.user(userId, 'kyc:frozen', { frozen: false });
    if (user.profile?.notifEmail !== false) void this.mail.kycUnfrozen(user.email, user.profile?.firstName ?? '').catch((e) => this.log.warn(e.message));
    return true;
  }

  /** Back office: lift the freeze and give the client a fresh window. */
  async unfreeze(actor: Actor, userId: string, extendDays = KYC_WINDOW_DAYS) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true, kycFrozenAt: true, kycDeadlineAt: true, profile: { select: { firstName: true, notifEmail: true } } } });
    if (!user || user.role !== 'client') throw ApiError.notFound('user_not_found', 'Client not found');
    const deadline = new Date(Date.now() + extendDays * DAY);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { kycFrozenAt: null, kycDeadlineAt: deadline, kycReminderSentAt: null } }),
      this.prisma.tradingAccount.updateMany({ where: { userId }, data: { tradingBlocked: false } }),
      this.prisma.adminAudit.create({ data: { actorId: actor.id, action: 'kyc.unfreeze', targetType: 'user', targetId: userId, before: { frozenAt: user.kycFrozenAt, deadlineAt: user.kycDeadlineAt }, after: { frozenAt: null, deadlineAt: deadline, extendDays }, ip: actor.ip } }),
      this.prisma.notification.create({ data: { userId, type: 'kyc', title: 'Trading resumed', body: `Our team lifted the freeze. You have ${extendDays} more days to upload the missing documents.` } }),
    ]);
    this.ws.notice(userId, { type: 'kyc', title: 'Trading resumed', body: `${extendDays} more days to upload your documents.`, level: 'success' });
    this.ws.user(userId, 'kyc:frozen', { frozen: false });
    if (user.profile?.notifEmail !== false) void this.mail.kycUnfrozen(user.email, user.profile?.firstName ?? '').catch((e) => this.log.warn(e.message));
    return { deadlineAt: deadline.toISOString() };
  }

  /** Back office list: frozen clients first, then the soonest deadlines, only those still missing documents. */
  async deadlines(limit = 100): Promise<KycDeadlineRowDto[]> {
    const users = await this.prisma.user.findMany({
      where: { role: 'client', status: 'active', kycDeadlineAt: { not: null } },
      select: { id: true, email: true, kycDeadlineAt: true, kycFrozenAt: true, profile: { select: { firstName: true, lastName: true } } },
      orderBy: { kycDeadlineAt: 'asc' },
    });
    const docs = await this.prisma.kycDocument.findMany({ where: { userId: { in: users.map((u) => u.id) }, status: { not: 'rejected' } }, select: { userId: true, group: true }, distinct: ['userId', 'group'] });
    const groups = new Map<string, KycGroup[]>();
    for (const d of docs) groups.set(d.userId, [...(groups.get(d.userId) ?? []), d.group]);
    const now = Date.now();
    return users
      .map((u) => {
        const g = groups.get(u.id) ?? [];
        return { user: { id: u.id, email: u.email, firstName: u.profile?.firstName ?? null, lastName: u.profile?.lastName ?? null }, deadlineAt: u.kycDeadlineAt!.toISOString(), daysLeft: KycDeadlineService.daysLeft(u.kycDeadlineAt!, now), frozen: !!u.kycFrozenAt, frozenAt: u.kycFrozenAt?.toISOString() ?? null, uploadedGroups: g, complete: g.length >= KYC_GROUPS.length };
      })
      .filter((r) => !r.complete)
      .sort((a, b) => Number(b.frozen) - Number(a.frozen) || a.daysLeft - b.daysLeft)
      .slice(0, limit);
  }
}
