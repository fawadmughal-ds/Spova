/** Shared helpers for the black-box e2e suites (run with `tsx --test`). */
import assert from 'node:assert/strict';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Redis from 'ioredis';

for (const c of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) if (existsSync(c)) loadDotenv({ path: c });

export const API = (process.env.API_URL ?? 'http://localhost:4000') + '/v1';
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@zerventa.local';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
export const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? '';
export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/** Minimal cookie-jar fetch client. */
export class Session {
  cookies = new Map<string, string>();
  constructor(private readonly extraHeaders: Record<string, string> = {}) {}
  private absorb(res: Response) {
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = sc.split(';');
      const [k, v] = pair.split('=');
      if (attrs.some((a) => a.trim().toLowerCase().startsWith('max-age=0')) || v === '') this.cookies.delete(k.trim());
      else this.cookies.set(k.trim(), v);
    }
  }
  async raw(method: string, path: string, body?: unknown, init: RequestInit = {}) {
    const headers: Record<string, string> = { ...this.extraHeaders, ...(init.headers as Record<string, string>) };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(API + path, { ...init, method, headers, body: payload });
    this.absorb(res);
    return res;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async json<T = any>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
    const res = await this.raw(method, path, body);
    const text = await res.text();
    return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
  }
}

export const created = (status: number) => [200, 201].includes(status);

/** The onboarding answers a client supplies after sign-up (DOB, country, address + suitability). */
export const ONBOARDING = {
  dob: '1990-01-01',
  countryCode: 'AE',
  address: '12 Marina Walk',
  city: 'Dubai',
  zip: '00000',
  sourceOfFunds: 'salary',
  employmentStatus: 'employed',
  annualIncome: '50k_100k',
  netWorth: '50k_250k',
  expectedDeposit: '1k_5k',
  jobRole: 'finance',
  usCitizen: 'no',
  pep: 'no',
  tradingExperience: '1_3y',
  tradingObjective: 'speculation',
};

/** Sign up (minimal fields) and complete the required onboarding, leaving `s` logged in with a full profile. */
export async function register(s: Session, tag: string) {
  const email = `e2e+${tag}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@zerventa.local`;
  const r = await s.json('POST', '/auth/register', {
    email,
    password: 'E2e!Passw0rd',
    firstName: 'E2e',
    lastName: tag,
    phone: '+971501234567',
    tcAccepted: true,
    riskAccepted: true,
  });
  assert.ok(created(r.status), `register: ${JSON.stringify(r.data)}`);
  const ob = await s.json('POST', '/me/onboarding', ONBOARDING);
  assert.ok(created(ob.status), `onboarding: ${JSON.stringify(ob.data)}`);
  return { email, me: ob.data };
}

export async function adminLogin(s: Session) {
  const login = await s.json('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(login.status, 200, `admin login: ${JSON.stringify(login.data)}`);
}

/** Local runs repeat quickly; clear the per-IP / per-user limits so the suites are repeatable (dev Redis only). */
export async function resetRateLimits() {
  if (process.env.E2E_KEEP_RATE_LIMITS === '1') return;
  const redis = new Redis(REDIS_URL);
  const keys: string[] = [];
  for (const pattern of ['rl:register:ip:*', 'rl:login:*', 'rl:kyc:upload:*', 'rl:payments:*', 'rl:tickets:*', 'rl:orders:*']) keys.push(...(await redis.keys(pattern)));
  if (keys.length) await redis.del(...keys);
  await redis.quit();
}
