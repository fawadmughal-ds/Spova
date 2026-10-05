import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load repo-root .env when running from apps/api (dev). In docker the env is injected.
for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate });
    break;
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  DEMO_START_BALANCE: z.string().regex(/^\d+(\.\d{1,2})?$/).default('10000'),
  DEMO_DEFAULT_LEVERAGE: z.coerce.number().int().min(1).max(1000).default(100),
  BRAND_NAME: z.string().default('XYZ'),
  APP_DOMAIN: z.string().default('localhost'),
  MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional().default(''),
  MAIL_FROM: z.string().default('no-reply@localhost'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/** "15m" | "7d" | "3600s" -> seconds */
export function ttlToSeconds(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) throw new Error(`Bad TTL: ${ttl}`);
  const n = Number(m[1]);
  return { s: n, m: n * 60, h: n * 3600, d: n * 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
}
