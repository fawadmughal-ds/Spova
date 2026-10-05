import type { CookieOptions, Response } from 'express';
import { COOKIE_NAMES } from '@spova/shared';
import { env, ttlToSeconds } from '../../config/env';
import type { TokenPair } from './auth.service';

const base = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export function setAuthCookies(res: Response, tokens: TokenPair) {
  res.cookie(COOKIE_NAMES.ACCESS, tokens.access, { ...base(), maxAge: ttlToSeconds(env.JWT_ACCESS_TTL) * 1000 });
  res.cookie(COOKIE_NAMES.REFRESH, tokens.refresh, {
    ...base(),
    maxAge: ttlToSeconds(env.JWT_REFRESH_TTL) * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(COOKIE_NAMES.ACCESS, { ...base() });
  res.clearCookie(COOKIE_NAMES.REFRESH, { ...base() });
}
