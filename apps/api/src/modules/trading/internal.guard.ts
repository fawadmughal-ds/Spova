import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../../config/env';
import { ApiError } from '../../common/errors';

/** Worker -> API calls carry a shared secret instead of a user session. */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const given = String(req.headers['x-internal-token'] ?? '');
    const want = env.INTERNAL_TOKEN;
    const ok = given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
    if (!ok) throw ApiError.unauthorized('internal_token', 'Invalid internal token');
    return true;
  }
}
