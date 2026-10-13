import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

export interface ActivityInput {
  userId?: string | null;
  kind: string;
  title: string;
  detail?: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

/**
 * Back-office activity feed + online presence.
 * - touch() refreshes a user's lastSeenAt at most once per minute (the admin "online" dot).
 * - record() appends one row to the activity feed. Both swallow errors: telemetry must never break a request.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Throttled presence touch — one DB write per user per 60s. */
  async touch(userId: string): Promise<void> {
    try {
      const fresh = await this.redis.client.set(`seen:${userId}`, '1', 'EX', 60, 'NX');
      if (fresh === 'OK') await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    } catch {
      /* presence is best-effort */
    }
  }

  /** Append a feed event (fire-and-forget safe). */
  async record(e: ActivityInput): Promise<void> {
    try {
      await this.prisma.activityEvent.create({
        data: { userId: e.userId ?? null, kind: e.kind, title: e.title, detail: e.detail ?? null, meta: (e.meta as object | undefined) ?? undefined, ip: e.ip ?? null },
      });
    } catch {
      /* feed is best-effort */
    }
  }

  /** Paged feed for the admin dashboard, newest first. */
  async list(q: { page: number; limit: number; kind?: string; userId?: string }) {
    const where = { ...(q.kind ? { kind: q.kind } : {}), ...(q.userId ? { userId: q.userId } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        include: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);
    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      userName: r.user ? [r.user.profile?.firstName, r.user.profile?.lastName].filter(Boolean).join(' ') || null : null,
      kind: r.kind,
      title: r.title,
      detail: r.detail,
      meta: r.meta,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, total, page: q.page, limit: q.limit };
  }

  /** How many feed events since this admin last opened the feed. */
  async unreadCount(adminId: string): Promise<number> {
    let since: Date | null = null;
    try {
      const raw = await this.redis.client.get(`activity:read:${adminId}`);
      if (raw) since = new Date(Number(raw));
    } catch {
      /* ignore */
    }
    return this.prisma.activityEvent.count({ where: since ? { createdAt: { gt: since } } : {} });
  }

  /** Mark the feed read for this admin (now). */
  async markRead(adminId: string): Promise<void> {
    try {
      await this.redis.client.set(`activity:read:${adminId}`, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
}
