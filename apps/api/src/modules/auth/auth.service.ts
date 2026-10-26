import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import type { LoginInput, MeDto, RegisterInput } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { RedisService } from '../../infra/redis.service';
import { MailService } from '../../infra/mail.service';
import { ActivityService } from '../../infra/activity.service';
import { AccountsService } from '../accounts/accounts.service';
import { env, ttlToSeconds } from '../../config/env';
import { ApiError } from '../../common/errors';
import type { AccessPayload, RefreshPayload } from '../../common/auth/auth.types';

export interface TokenPair {
  access: string;
  refresh: string;
  sessionId: string;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly accounts: AccountsService,
    private readonly activity: ActivityService,
  ) {}

  // ---------------------------------------------------------------- register / login

  async register(input: RegisterInput, meta: { ip: string; ua?: string }): Promise<{ me: MeDto; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw ApiError.conflict('email_taken', 'An account with this email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const now = new Date();

    const { user, account } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          tcAcceptedAt: now,
          riskAcceptedAt: now,
          lastLoginAt: now,
          lastLoginIp: meta.ip,
          // Minimal sign-up: only name, phone. DOB, country, address and the suitability
          // questionnaire are captured in the required onboarding step on first dashboard entry.
          // sign-up opens a LIVE account; the 15-day window to upload KYC documents starts now.
          kycDeadlineAt: new Date(Date.now() + 15 * 86_400_000),
          profile: {
            create: {
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
            },
          },
        },
        include: { profile: true },
      });
      // sign-up opens a LIVE account (no demo); the client lands on it on first login.
      const account = await this.accounts.createInTx(tx, user.id, 'live');
      return { user, account };
    });

    void this.mail.welcome(user.email, input.firstName, account.loginCode).catch((e) => this.log.warn(e.message));

    if (user.role === 'client' && user.profile?.notifEmail !== false) void this.mail.login(user.email, user.profile?.firstName ?? '', new Date(), meta.ip).catch((e) => this.log.warn(e.message));

    void this.activity.record({ userId: user.id, kind: 'register', title: 'Signed up', detail: user.email, ip: meta.ip });

    const tokens = await this.issueTokens(user.id, user.role, meta);
    return { me: await this.toMe(user), tokens };
  }

  async login(input: LoginInput, meta: { ip: string; ua?: string }): Promise<{ me: MeDto; tokens: TokenPair }> {
    const [ipOk, emailOk] = await Promise.all([
      this.redis.allow(`login:ip:${meta.ip}`, 10, 60),
      this.redis.allow(`login:email:${input.email}`, 20, 3600),
    ]);
    if (!ipOk || !emailOk) throw ApiError.tooMany('Too many login attempts. Try again later.');

    const user = await this.prisma.user.findUnique({ where: { email: input.email }, include: { profile: true } });
    const ok = user ? await argon2.verify(user.passwordHash, input.password) : false;
    if (!user || !ok) throw ApiError.unauthorized('bad_credentials', 'Invalid email or password');
    if (user.status === 'frozen') throw ApiError.forbidden('account_frozen', 'Your account is frozen. Contact support.');
    if (user.status === 'closed') throw ApiError.forbidden('account_closed', 'This account is closed.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: meta.ip },
    });

    if (user.role === 'client') void this.activity.record({ userId: user.id, kind: 'login', title: 'Logged in', detail: user.email, ip: meta.ip });

    const tokens = await this.issueTokens(user.id, user.role, meta);
    return { me: await this.toMe(user), tokens };
  }

  // ---------------------------------------------------------------- tokens

  private async issueTokens(userId: string, role: MeDto['role'], meta: { ip: string; ua?: string }): Promise<TokenPair> {
    const refreshTtl = ttlToSeconds(env.JWT_REFRESH_TTL);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: 'pending',
        ip: meta.ip,
        userAgent: meta.ua?.slice(0, 300),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
      select: { id: true },
    });
    return this.signPair(userId, role, session.id);
  }

  private async signPair(userId: string, role: MeDto['role'], sessionId: string): Promise<TokenPair> {
    const accessPayload: AccessPayload = { sub: userId, role, sid: sessionId };
    const refreshPayload: RefreshPayload = { sub: userId, sid: sessionId };
    const [access, refresh] = await Promise.all([
      this.jwt.signAsync(accessPayload, { secret: env.JWT_ACCESS_SECRET, expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL) }),
      this.jwt.signAsync(refreshPayload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: ttlToSeconds(env.JWT_REFRESH_TTL),
        jwtid: randomBytes(8).toString('hex'),
      }),
    ]);
    await this.prisma.session.update({ where: { id: sessionId }, data: { tokenHash: sha256(refresh) } });
    return { access, refresh, sessionId };
  }

  /** Rotate refresh. Reuse of an already-rotated token = theft signal -> revoke all sessions. */
  async refresh(refreshToken: string | undefined, meta: { ip: string; ua?: string }): Promise<TokenPair> {
    if (!refreshToken) throw ApiError.unauthorized('no_refresh', 'Not signed in');
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw ApiError.unauthorized('refresh_expired', 'Session expired');
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub) throw ApiError.unauthorized('session_invalid', 'Session invalid');

    if (session.revokedAt || session.expiresAt < new Date()) {
      throw ApiError.unauthorized('session_revoked', 'Session revoked');
    }
    if (session.tokenHash !== sha256(refreshToken)) {
      // Old rotated token presented again: revoke everything for this user.
      this.log.warn(`refresh reuse detected user=${payload.sub} session=${payload.sid} ip=${meta.ip}`);
      await this.revokeAllSessions(payload.sub);
      throw ApiError.unauthorized('session_reuse', 'Session invalidated. Please sign in again.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { role: true, status: true } });
    if (!user || user.status !== 'active') {
      await this.revokeSession(session.id);
      throw ApiError.forbidden('account_frozen', 'Account not active');
    }

    return this.signPair(payload.sub, user.role, session.id);
  }

  // ---------------------------------------------------------------- deposit magic-link
  /** Admin-issued one-click deposit link: a 15-minute, single-use token that logs the client straight into the deposit page. */
  async createDepositLinkToken(userId: string): Promise<string> {
    const jti = randomBytes(16).toString('hex');
    await this.redis.client.set(`dmagic:${jti}`, userId, 'EX', 900);
    return this.jwt.signAsync({ sub: userId, purpose: 'deposit', jti }, { secret: env.JWT_ACCESS_SECRET, expiresIn: 900 });
  }

  /** Validate + burn a deposit link, then issue a normal session for that client. */
  async consumeDepositLink(token: string, meta: { ip: string; ua?: string }): Promise<{ me: MeDto; tokens: TokenPair }> {
    let payload: { sub: string; purpose?: string; jti?: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: env.JWT_ACCESS_SECRET });
    } catch {
      throw ApiError.unauthorized('link_expired', 'This link has expired. Ask support for a new one.');
    }
    if (payload.purpose !== 'deposit' || !payload.jti) throw ApiError.unauthorized('link_invalid', 'Invalid link');
    // single use: the key must still exist and is removed atomically
    const burned = await this.redis.client.getdel(`dmagic:${payload.jti}`);
    if (burned !== payload.sub) throw ApiError.unauthorized('link_used', 'This link has already been used. Ask support for a new one.');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { profile: true } });
    if (!user || user.status !== 'active') throw ApiError.unauthorized('link_invalid', 'Invalid link');
    const tokens = await this.issueTokens(user.id, user.role, meta);
    void this.activity.record({ userId: user.id, kind: 'deposit_link', title: 'Opened a deposit link', detail: user.email, ip: meta.ip });
    return { me: await this.toMe(user), tokens };
  }

  async logout(sessionId: string) {
    const sess = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true, user: { select: { role: true, email: true } } } });
    await this.revokeSession(sessionId);
    if (sess?.user?.role === 'client') void this.activity.record({ userId: sess.userId, kind: 'logout', title: 'Logged out', detail: sess.user.email });
  }

  async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.redis.client.set(`sess:revoked:${sessionId}`, '1', 'EX', ttlToSeconds(env.JWT_ACCESS_TTL) + 60);
  }

  async revokeAllSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({ where: { userId, revokedAt: null }, select: { id: true } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const ttl = ttlToSeconds(env.JWT_ACCESS_TTL) + 60;
    if (sessions.length) {
      const pipe = this.redis.client.pipeline();
      for (const s of sessions) pipe.set(`sess:revoked:${s.id}`, '1', 'EX', ttl);
      await pipe.exec();
    }
  }

  // ---------------------------------------------------------------- password reset

  async forgotPassword(email: string, ip: string) {
    const ok = await this.redis.allow(`forgot:${email}`, 3, 3600);
    const okIp = await this.redis.allow(`forgot:ip:${ip}`, 10, 3600);
    if (!ok || !okIp) return; // always 200
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, email: true, status: true } });
    if (!user || user.status !== 'active') return;

    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600 * 1000) },
    });
    await this.mail.passwordReset(user.email, token);
  }

  async resetPassword(token: string, password: string) {
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw ApiError.badRequest('reset_invalid', 'This reset link is invalid or has expired');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await this.revokeAllSessions(row.userId);
  }

  async changePassword(userId: string, current: string, next: string, keepSessionId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current))) {
      throw ApiError.badRequest('bad_current_password', 'Current password is incorrect');
    }
    const passwordHash = await argon2.hash(next, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Log out every other device.
    const others = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, NOT: { id: keepSessionId } },
      select: { id: true },
    });
    for (const s of others) await this.revokeSession(s.id);
  }

  // ---------------------------------------------------------------- me

  async me(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw ApiError.unauthorized();
    return this.toMe(user);
  }

  async toMe(user: {
    id: string;
    email: string;
    role: MeDto['role'];
    status: MeDto['status'];
    kycPoi: boolean;
    kycPor: boolean;
    kycPayment: boolean;
    kycDeadlineAt?: Date | null;
    kycFrozenAt?: Date | null;
    emailVerifiedAt: Date | null;
    profile: {
      firstName: string;
      lastName: string;
      phone: string;
      dob: Date | null;
      countryCode: string | null;
      city: string | null;
      address: string | null;
      zip: string | null;
      language: string;
      notifEmail: boolean;
      notifSms: boolean;
      notifPush: boolean;
      notifCalls: boolean;
      sourceOfFunds: string | null;
      employmentStatus: string | null;
      jobRole: string | null;
      jobRoleOther: string | null;
      annualIncome: string | null;
      netWorth: string | null;
      expectedDeposit: string | null;
      tradingExperience: string | null;
      tradingObjective: string | null;
      usCitizen: string | null;
      pep: string | null;
    } | null;
  }): Promise<MeDto> {
    const groups = user.role === 'client' ? await this.prisma.kycDocument.findMany({ where: { userId: user.id, status: { not: 'rejected' } }, select: { group: true }, distinct: ['group'] }) : [];
    const deadline = user.kycDeadlineAt ?? null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      kyc: {
        poi: user.kycPoi,
        por: user.kycPor,
        payment: user.kycPayment,
        deadlineAt: deadline ? deadline.toISOString() : null,
        daysLeft: deadline ? Math.ceil((deadline.getTime() - Date.now()) / 86_400_000) : null,
        complete: groups.length >= 4,
        frozen: !!user.kycFrozenAt,
      },
      emailVerified: !!user.emailVerifiedAt,
      // Onboarding is done once DOB, country, address and every suitability answer are on file.
      profileComplete: !!(
        user.profile &&
        user.profile.dob &&
        user.profile.countryCode &&
        user.profile.address &&
        user.profile.city &&
        user.profile.sourceOfFunds &&
        user.profile.employmentStatus &&
        user.profile.jobRole &&
        user.profile.annualIncome &&
        user.profile.netWorth &&
        user.profile.expectedDeposit &&
        user.profile.tradingExperience &&
        user.profile.tradingObjective &&
        user.profile.usCitizen &&
        user.profile.pep
      ),
      profile: user.profile
        ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phone: user.profile.phone,
            dob: user.profile.dob ? user.profile.dob.toISOString().slice(0, 10) : null,
            countryCode: user.profile.countryCode,
            city: user.profile.city,
            address: user.profile.address,
            zip: user.profile.zip,
            language: user.profile.language,
            notifEmail: user.profile.notifEmail,
            notifSms: user.profile.notifSms,
            notifPush: user.profile.notifPush,
            notifCalls: user.profile.notifCalls,
            sourceOfFunds: user.profile.sourceOfFunds,
            employmentStatus: user.profile.employmentStatus,
            jobRole: user.profile.jobRole,
            jobRoleOther: user.profile.jobRoleOther,
            annualIncome: user.profile.annualIncome,
            netWorth: user.profile.netWorth,
            expectedDeposit: user.profile.expectedDeposit,
            tradingExperience: user.profile.tradingExperience,
            tradingObjective: user.profile.tradingObjective,
            usCitizen: user.profile.usCitizen,
            pep: user.profile.pep,
          }
        : null,
    };
  }
}
