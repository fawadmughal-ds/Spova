import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Ticket, TicketMessage, TicketStatus } from '@prisma/client';
import { WS_EVENTS, type CreateTicketInput, type Paginated, type TicketDetailDto, type TicketDto, type TicketMessageDto } from '@spova/shared';
import { PrismaService } from '../../infra/prisma.service';
import { MailService } from '../../infra/mail.service';
import { ActivityService } from '../../infra/activity.service';
import { RedisService } from '../../infra/redis.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ApiError } from '../../common/errors';

interface Actor {
  id: string;
  ip?: string;
}

type TicketRow = Ticket & { messages: TicketMessage[]; _count?: { messages: number }; user?: { id: string; email: string; profile: { firstName: string; lastName: string } | null } | null };

const msgToDto = (m: TicketMessage): TicketMessageDto => ({ id: m.id, authorId: m.authorId, body: m.body, isStaff: m.isStaff, createdAt: m.createdAt.toISOString() });

const ticketToDto = (t: TicketRow, withUser: boolean): TicketDto => {
  const last = t.messages[t.messages.length - 1];
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    messageCount: t._count?.messages ?? t.messages.length,
    lastMessage: last ? { body: last.body.slice(0, 160), isStaff: last.isStaff, createdAt: last.createdAt.toISOString() } : null,
    ...(withUser && t.user && { user: { id: t.user.id, email: t.user.email, firstName: t.user.profile?.firstName ?? null, lastName: t.user.profile?.lastName ?? null } }),
  };
};

/** Support tickets: client opens, staff answers, either side closes. Status: open (client's turn to be answered) -> answered -> closed. */
@Injectable()
export class SupportService {
  private readonly log = new Logger('Support');

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly redis: RedisService,
    private readonly ws: RealtimeGateway,
    private readonly activity: ActivityService,
  ) {}

  // ---------------------------------------------------------------- client

  async listMine(userId: string): Promise<TicketDto[]> {
    const rows = await this.prisma.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { messages: { orderBy: { createdAt: 'asc' } }, _count: { select: { messages: true } } },
    });
    return rows.map((t) => ticketToDto(t, false));
  }

  async create(userId: string, input: CreateTicketInput): Promise<TicketDetailDto> {
    if (!(await this.redis.allow(`tickets:${userId}`, 10, 3600))) throw ApiError.tooMany('Too many tickets. Try again later.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const t = await this.prisma.ticket.create({
      data: { userId, subject: input.subject, messages: { create: { authorId: userId, body: input.message, isStaff: false } } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    this.ws.admin(WS_EVENTS.ADMIN_TICKET_NEW, { id: t.id, userId, subject: t.subject, email: user.email, createdAt: t.createdAt.toISOString() });
    void this.mail.adminAlert('New support ticket', `${user.email}: ${t.subject}\n\n${input.message}`).catch((e) => this.log.warn(e.message));
    void this.activity.record({ userId, kind: 'ticket_open', title: 'Opened a support ticket', detail: t.subject });
    return { ...ticketToDto(t, false), messages: t.messages.map(msgToDto) };
  }

  async getMine(userId: string, id: string): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findFirst({ where: { id, userId }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    return { ...ticketToDto(t, false), messages: t.messages.map(msgToDto) };
  }

  async replyMine(userId: string, id: string, body: string): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findFirst({ where: { id, userId } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    if (t.status === 'closed') throw ApiError.conflict('ticket_closed', 'This ticket is closed. Open a new one.');
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { status: 'open', messages: { create: { authorId: userId, body, isStaff: false } } },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    this.ws.admin(WS_EVENTS.TICKET_UPDATED, { id, status: 'open' });
    return { ...ticketToDto(updated, false), messages: updated.messages.map(msgToDto) };
  }

  async closeMine(userId: string, id: string): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findFirst({ where: { id, userId } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    const updated = await this.prisma.ticket.update({ where: { id }, data: { status: 'closed' }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    return { ...ticketToDto(updated, false), messages: updated.messages.map(msgToDto) };
  }

  // ---------------------------------------------------------------- admin

  async inbox(q: { status?: TicketStatus; userId?: string; page: number; limit: number }): Promise<Paginated<TicketDto>> {
    const where: Prisma.TicketWhereInput = { ...(q.status && { status: q.status }), ...(q.userId && { userId: q.userId }) };
    const [total, rows] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        include: { messages: { orderBy: { createdAt: 'asc' } }, _count: { select: { messages: true } }, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
      }),
    ]);
    return { items: rows.map((t) => ticketToDto(t, true)), total, page: q.page, limit: q.limit };
  }

  async get(id: string): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    return { ...ticketToDto(t, true), messages: t.messages.map(msgToDto) };
  }

  async reply(actor: Actor, id: string, body: string): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findUnique({ where: { id }, include: { user: { select: { email: true, profile: { select: { notifEmail: true } } } } } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ticket.update({
        where: { id },
        data: { status: 'answered', assignedTo: actor.id, messages: { create: { authorId: actor.id, body, isStaff: true } } },
        include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } },
      });
      await tx.adminAudit.create({ data: { actorId: actor.id, action: 'ticket.reply', targetType: 'ticket', targetId: id, after: { status: 'answered' }, ip: actor.ip } });
      await tx.notification.create({ data: { userId: t.userId, type: 'ticket', title: `Reply: ${t.subject}`, body: body.slice(0, 200) } });
      return u;
    });
    this.ws.user(t.userId, WS_EVENTS.TICKET_UPDATED, { id, status: 'answered' });
    this.ws.notice(t.userId, { type: 'ledger', title: 'Support replied', body: t.subject, level: 'info' });
    if (t.user.profile?.notifEmail) void this.mail.ticketReply(t.user.email, t.subject, body).catch((e) => this.log.warn(e.message));
    return { ...ticketToDto(updated, true), messages: updated.messages.map(msgToDto) };
  }

  async setStatus(actor: Actor, id: string, status: TicketStatus): Promise<TicketDetailDto> {
    const t = await this.prisma.ticket.findUnique({ where: { id } });
    if (!t) throw ApiError.notFound('ticket_not_found', 'Ticket not found');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.ticket.update({ where: { id }, data: { status }, include: { messages: { orderBy: { createdAt: 'asc' } }, user: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true } } } } } });
      await tx.adminAudit.create({ data: { actorId: actor.id, action: `ticket.${status}`, targetType: 'ticket', targetId: id, before: { status: t.status }, after: { status }, ip: actor.ip } });
      return u;
    });
    this.ws.user(t.userId, WS_EVENTS.TICKET_UPDATED, { id, status });
    return { ...ticketToDto(updated, true), messages: updated.messages.map(msgToDto) };
  }
}
