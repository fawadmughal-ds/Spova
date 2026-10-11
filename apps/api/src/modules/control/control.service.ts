import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_PLATFORM_SETTINGS,
  platformSettingsSchema,
  type AdminSymbolDto,
  type AdminSymbolPatch,
  type BroadcastInput,
  type BroadcastResultDto,
  type PlatformPublicDto,
  type PlatformSettings,
  type RiskConfigDto,
  type RiskConfigInput,
  type StaffCreateInput,
  type StaffDto,
  type StaffPatchInput,
  type Tier, DEFAULT_EMAIL_SETTINGS, EMAIL_SETTINGS_KEY, emailSettingsSchema, type EmailSettings } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { SettingsService } from '../../infra/settings.service';
import { MailService } from '../../infra/mail.service';
import { QuotesService } from '../quotes/quotes.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../../common/errors';
import { money } from '../../common/money';

interface Actor {
  id: string;
  role: string;
  ip?: string;
}
export const PLATFORM_KEY = 'platform';

/** Back-office controls: instruments, risk tiers, platform switches, staff and broadcasts. Every change is audited. */
@Injectable()
export class ControlService {
  private readonly log = new Logger('Control');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly settings: SettingsService,
    private readonly mail: MailService,
    private readonly quotes: QuotesService,
    private readonly ws: RealtimeGateway,
    private readonly auth: AuthService,
  ) {}

  private audit(actor: Actor, action: string, targetType: string, targetId: string | null, before: unknown, after: unknown) {
    return this.prisma.adminAudit.create({ data: { actorId: actor.id, action, targetType, targetId, before: before as Prisma.InputJsonValue, after: after as Prisma.InputJsonValue, ip: actor.ip } });
  }

  // ---------------------------------------------------------------- instruments

  async symbols(): Promise<AdminSymbolDto[]> {
    const rows = await this.prisma.symbol.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
    const open = await this.prisma.position.groupBy({ by: ['symbolId'], where: { status: 'open' }, _count: { _all: true } });
    const openBy = new Map(open.map((o) => [o.symbolId, o._count._all]));
    const pipe = this.redis.client.pipeline();
    for (const s of rows) pipe.hgetall(`price:${s.id}`);
    const quotes = (await pipe.exec()) ?? [];
    return rows.map((s, i) => {
      const q = (quotes[i]?.[1] ?? {}) as Record<string, string>;
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
        swapLong: s.swapLong.toString(),
        swapShort: s.swapShort.toString(),
        feedSource: s.feedSource,
        feedSymbol: s.feedSymbol,
        enabled: s.enabled,
        featured: s.featured,
        sortOrder: s.sortOrder,
        bid: q.bid ?? null,
        ask: q.ask ?? null,
        quoteTs: q.ts ? Number(q.ts) : null,
        openPositions: openBy.get(s.id) ?? 0,
      };
    });
  }

  async patchSymbol(actor: Actor, id: string, patch: AdminSymbolPatch) {
    const before = await this.prisma.symbol.findUnique({ where: { id } });
    if (!before) throw ApiError.notFound('symbol_not_found', 'Instrument not found');
    if (patch.enabled === false) {
      const open = await this.prisma.position.count({ where: { symbolId: id, status: 'open' } });
      if (open > 0) throw ApiError.conflict('positions_open', `${open} open position(s) on ${id}. Close them before disabling the instrument.`);
    }
    if (patch.minLot !== undefined || patch.maxLot !== undefined) {
      const min = Number(patch.minLot ?? before.minLot);
      const max = Number(patch.maxLot ?? before.maxLot);
      if (min > max) throw ApiError.badRequest('lots_invalid', 'Minimum lot cannot exceed maximum lot');
    }
    const after = await this.prisma.symbol.update({ where: { id }, data: patch });
    await this.audit(actor, 'symbol.update', 'symbol', null, { id, ...pick(before, Object.keys(patch)) }, { id, ...patch });
    this.quotes.invalidate();
    this.ws.admin('admin:symbol:update', { id, patch });
    return (await this.symbols()).find((s) => s.id === after.id)!;
  }

  // ---------------------------------------------------------------- risk tiers

  async riskConfigs(): Promise<RiskConfigDto[]> {
    const [rows, counts] = await Promise.all([this.prisma.riskConfig.findMany(), this.prisma.tradingAccount.groupBy({ by: ['tier'], _count: { _all: true } })]);
    const by = new Map(counts.map((c) => [c.tier, c._count._all]));
    const order: Tier[] = ['classic', 'silver', 'gold', 'platinum', 'vip'];
    return rows
      .sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
      .map((r) => ({
        tier: r.tier,
        marginCallPct: Number(r.marginCallPct),
        stopOutPct: Number(r.stopOutPct),
        defaultLeverage: r.defaultLeverage,
        maxLeverage: r.maxLeverage,
        minDeposit: money(r.minDeposit),
        spreadDiscountPct: Number(r.spreadDiscountPct),
        accounts: by.get(r.tier) ?? 0,
      }));
  }

  async putRiskConfig(actor: Actor, tier: Tier, input: RiskConfigInput) {
    const before = await this.prisma.riskConfig.findUnique({ where: { tier } });
    if (!before) throw ApiError.notFound('tier_not_found', 'Unknown tier');
    await this.prisma.riskConfig.update({
      where: { tier },
      data: { marginCallPct: input.marginCallPct.toFixed(2), stopOutPct: input.stopOutPct.toFixed(2), defaultLeverage: input.defaultLeverage, maxLeverage: input.maxLeverage, minDeposit: input.minDeposit, spreadDiscountPct: input.spreadDiscountPct.toFixed(2) },
    });
    await this.audit(actor, 'risk.update', 'risk_config', null, { ...before, minDeposit: money(before.minDeposit) }, { tier, ...input });
    return (await this.riskConfigs()).find((r) => r.tier === tier)!;
  }

  // ---------------------------------------------------------------- platform switches

  async platform(): Promise<PlatformSettings> {
    const stored = await this.settings.get<Partial<PlatformSettings>>(PLATFORM_KEY, {});
    const parsed = platformSettingsSchema.safeParse({ ...DEFAULT_PLATFORM_SETTINGS, ...stored, tradingHalt: { ...DEFAULT_PLATFORM_SETTINGS.tradingHalt, ...stored.tradingHalt }, announcement: { ...DEFAULT_PLATFORM_SETTINGS.announcement, ...stored.announcement } });
    return parsed.success ? parsed.data : DEFAULT_PLATFORM_SETTINGS;
  }

  async platformPublic(): Promise<PlatformPublicDto> {
    const p = await this.platform();
    return { tradingHalt: p.tradingHalt, announcement: p.announcement, registrationOpen: p.registrationOpen, liveAccountsOpen: p.liveAccountsOpen };
  }

  async setPlatform(actor: Actor, input: PlatformSettings) {
    const before = await this.platform();
    await this.settings.set(PLATFORM_KEY, input, actor.id);
    await this.audit(actor, 'platform.update', 'app_setting', null, before, input);
    // everyone connected learns about a halt / announcement change at once
    this.ws.broadcast('platform:update', await this.platformPublic());
    this.log.warn({ halt: input.tradingHalt.enabled, registration: input.registrationOpen }, 'platform switches changed');
    return input;
  }

  async emailSettings(): Promise<EmailSettings> {
    const stored = await this.settings.get<Partial<EmailSettings>>(EMAIL_SETTINGS_KEY, {});
    const parsed = emailSettingsSchema.safeParse({ ...DEFAULT_EMAIL_SETTINGS, ...stored });
    return parsed.success ? parsed.data : DEFAULT_EMAIL_SETTINGS;
  }

  async setEmailSettings(actor: Actor, input: EmailSettings) {
    const before = await this.emailSettings();
    await this.settings.set(EMAIL_SETTINGS_KEY, input, actor.id);
    await this.audit(actor, 'email_settings.update', 'app_setting', null, before, input);
    return input;
  }

  // ---------------------------------------------------------------- staff

  async staff(): Promise<StaffDto[]> {
    const rows = await this.prisma.user.findMany({ where: { role: { in: ['admin', 'superadmin'] } }, include: { profile: true }, orderBy: { createdAt: 'asc' } });
    return rows.map((u) => ({ id: u.id, email: u.email, firstName: u.profile?.firstName ?? null, lastName: u.profile?.lastName ?? null, role: u.role as 'admin' | 'superadmin', status: u.status, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }));
  }

  async createStaff(actor: Actor, input: StaffCreateInput) {
    if (actor.role !== 'superadmin') throw ApiError.forbidden('superadmin_only', 'Only a superadmin can add staff');
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw ApiError.conflict('email_taken', 'A user with this email already exists');
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, role: input.role, status: 'active', emailVerifiedAt: new Date(), tcAcceptedAt: new Date(), riskAcceptedAt: new Date(), profile: { create: { firstName: input.firstName, lastName: input.lastName, phone: '', countryCode: 'XX' } } },
    });
    await this.audit(actor, 'staff.create', 'user', user.id, null, { email: input.email, role: input.role });
    return (await this.staff()).find((s) => s.id === user.id)!;
  }

  async patchStaff(actor: Actor, id: string, input: StaffPatchInput) {
    if (actor.role !== 'superadmin') throw ApiError.forbidden('superadmin_only', 'Only a superadmin can change staff');
    if (id === actor.id) throw ApiError.badRequest('self_change', 'You cannot change your own role or status');
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before || !['admin', 'superadmin'].includes(before.role)) throw ApiError.notFound('staff_not_found', 'Staff member not found');
    if (before.role === 'superadmin' && (input.role === 'admin' || input.status === 'frozen')) {
      const supers = await this.prisma.user.count({ where: { role: 'superadmin', status: 'active' } });
      if (supers <= 1) throw ApiError.conflict('last_superadmin', 'At least one active superadmin must remain');
    }
    await this.prisma.user.update({ where: { id }, data: input });
    // a frozen staff member is signed out everywhere at once (DB sessions + the Redis revocation the guard checks)
    if (input.status === 'frozen') await this.auth.revokeAllSessions(id);
    await this.audit(actor, 'staff.update', 'user', id, { role: before.role, status: before.status }, input);
    return (await this.staff()).find((s) => s.id === id)!;
  }

  // ---------------------------------------------------------------- broadcast

  async broadcast(actor: Actor, input: BroadcastInput): Promise<BroadcastResultDto> {
    const where: Prisma.UserWhereInput = { role: 'client', status: 'active', ...(input.audience === 'all' ? {} : { accounts: { some: { type: input.audience } } }) };
    const users = await this.prisma.user.findMany({ where, select: { id: true, email: true, profile: { select: { notifEmail: true } } } });
    if (users.length === 0) return { recipients: 0, emailed: 0 };
    await this.prisma.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: 'broadcast', title: input.title, body: input.body })) });
    for (const u of users) this.ws.notice(u.id, { type: 'broadcast', title: input.title, body: input.body, level: input.level });
    let emailed = 0;
    if (input.email) {
      for (const u of users) {
        if (u.profile?.notifEmail === false) continue;
        emailed++;
        void this.mail.send({ to: u.email, subject: input.title, text: input.body, html: `<p>${escapeHtml(input.body).replace(/\n/g, '<br>')}</p>` }).catch((e) => this.log.warn(e.message));
      }
    }
    await this.audit(actor, 'broadcast.send', 'notification', null, null, { ...input, recipients: users.length, emailed });
    return { recipients: users.length, emailed };
  }
}

const pick = <T extends object>(o: T, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, (o as Record<string, unknown>)[k]]));
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
