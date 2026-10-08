import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import { COOKIE_NAMES, WS_EVENTS, type WsAccountSnapshot, type WsNotice } from '@spova/shared';
import { env } from '../../config/env';
import type { AccessPayload } from '../../common/auth/auth.types';
import { ADMIN_ROLES } from '../../common/auth/auth.types';
import { RedisService } from '../../infra/redis.service';
import { PrismaService } from '../../infra/prisma.service';

interface SocketData {
  userId: string;
  role: AccessPayload['role'];
  accountId?: string;
}

const CH = 'ws:events';

/**
 * socket.io namespace /ws, cookie auth on handshake (ARCHITECTURE §05).
 * Any service (api or worker) publishes {room, event, payload} on Redis channel ws:events;
 * this gateway relays it to the room. Keeps the API stateless for later horizontal scaling.
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()), credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('WS');

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.redis.sub.subscribe(CH).catch((e) => this.log.error(e.message));
    this.redis.sub.on('message', (channel, raw) => {
      if (channel !== CH) return;
      try {
        const { room, event, payload } = JSON.parse(raw) as { room: string; event: string; payload: unknown };
        this.server.to(room).emit(event, payload);
      } catch (e) {
        this.log.warn(`bad ws event: ${(e as Error).message}`);
      }
    });
  }

  async handleConnection(client: Socket) {
    try {
      const cookies = parseCookie(client.handshake.headers.cookie ?? '');
      const token = cookies[COOKIE_NAMES.ACCESS] ?? (client.handshake.auth?.token as string | undefined);
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: env.JWT_ACCESS_SECRET });
      if (await this.redis.client.exists(`sess:revoked:${payload.sid}`)) throw new Error('revoked');

      const data: SocketData = { userId: payload.sub, role: payload.role };
      client.data = data;
      await client.join(`user:${payload.sub}`);
      if (ADMIN_ROLES.includes(payload.role)) await client.join('admin');
    } catch (e) {
      this.log.debug(`ws reject: ${(e as Error).message}`);
      client.emit('error', { code: 'unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    /* nothing to clean, rooms auto-leave */
  }

  @SubscribeMessage(WS_EVENTS.PING)
  ping() {
    return { event: WS_EVENTS.PONG, data: { ts: Date.now() } };
  }

  @SubscribeMessage(WS_EVENTS.SELECT_ACCOUNT)
  async selectAccount(@ConnectedSocket() client: Socket, @MessageBody() body: { accountId?: string }) {
    const data = client.data as SocketData;
    if (!body?.accountId) return { ok: false };
    const acc = await this.prisma.tradingAccount.findFirst({
      where: { id: body.accountId, ...(ADMIN_ROLES.includes(data.role) ? {} : { userId: data.userId }) },
      select: { id: true },
    });
    if (!acc) return { ok: false };
    if (data.accountId) await client.leave(`account:${data.accountId}`);
    data.accountId = acc.id;
    await client.join(`account:${acc.id}`);
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE)
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { symbols?: string[] }) {
    const symbols = (body?.symbols ?? []).slice(0, 50);
    for (const s of symbols) await client.join(`symbol:${s}`);
    return { ok: true, count: symbols.length };
  }

  @SubscribeMessage(WS_EVENTS.UNSUBSCRIBE)
  async unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { symbols?: string[] }) {
    for (const s of body?.symbols ?? []) await client.leave(`symbol:${s}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- publish helpers (via Redis so worker can use the same channel)

  private publish(room: string, event: string, payload: unknown) {
    return this.redis.client.publish(CH, JSON.stringify({ room, event, payload }));
  }

  accountSnapshot(userId: string, snapshot: WsAccountSnapshot) {
    void this.publish(`user:${userId}`, WS_EVENTS.ACCOUNT, snapshot);
    void this.publish(`account:${snapshot.accountId}`, WS_EVENTS.ACCOUNT, snapshot);
  }

  notice(userId: string, notice: WsNotice) {
    void this.publish(`user:${userId}`, WS_EVENTS.NOTICE, notice);
  }

  admin(event: string, payload: unknown) {
    void this.publish('admin', event, payload);
  }

  /** Any other event addressed to one user (kyc:status, payment:status, ticket:updated). */
  user(userId: string, event: string, payload: unknown) {
    void this.publish(`user:${userId}`, event, payload);
  }
}
