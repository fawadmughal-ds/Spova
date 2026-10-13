import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { COOKIE_NAMES } from '@spova/shared';
import { env } from '../../config/env';
import { ApiError } from '../errors';
import { PUBLIC_KEY, ROLES_KEY } from './decorators';
import type { AccessPayload, AuthUser } from './auth.types';
import type { Role } from '@spova/shared';
import { RedisService } from '../../infra/redis.service';
import { ActivityService } from '../../infra/activity.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly activity: ActivityService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.[COOKIE_NAMES.ACCESS] ?? bearer(req);
    if (!token) throw ApiError.unauthorized();

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { secret: env.JWT_ACCESS_SECRET });
    } catch {
      throw ApiError.unauthorized('token_expired', 'Session expired');
    }

    // Session revoked (logout / freeze / rotation reuse)?
    if (await this.redis.client.exists(`sess:revoked:${payload.sid}`)) {
      throw ApiError.unauthorized('session_revoked', 'Session revoked');
    }

    req.user = { id: payload.sub, role: payload.role, sessionId: payload.sid };

    // presence: refresh the online dot (throttled, best-effort, non-blocking) for clients
    if (payload.role === 'client') void this.activity.touch(payload.sub);

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(payload.role)) {
      throw ApiError.forbidden();
    }
    return true;
  }
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}
