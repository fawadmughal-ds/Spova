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
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return (first ?? req.socket?.remoteAddress ?? '').trim();
});
