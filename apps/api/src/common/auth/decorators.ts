import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@spova/shared';
import type { AuthUser } from './auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  // Behind one trusted proxy (Render / Cloudflare) the proxy appends the real client IP as the LAST entry;
  // anything before it can be forged by the client, so never trust the first entry.
  const fwd = req.headers['x-forwarded-for'];
  const list = (Array.isArray(fwd) ? fwd.join(',') : (fwd ?? '')).split(',').map((s: string) => s.trim()).filter(Boolean);
  return (list[list.length - 1] ?? req.socket?.remoteAddress ?? '').trim();
});
