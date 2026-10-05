import type { Role } from '@spova/shared';

export interface AccessPayload {
  sub: string; // user id
  role: Role;
  sid: string; // session id (refresh jti) so we can revoke
}

export interface RefreshPayload {
  sub: string;
  sid: string;
}

export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
}

export const ADMIN_ROLES: Role[] = ['admin', 'superadmin'];
