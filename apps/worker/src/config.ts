import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load the repo-root .env (or a local one) before anything reads process.env.
for (const c of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(c)) {
    loadDotenv({ path: c });
    break;
  }
}

const onOff = z
  .enum(['on', 'off'])
  .default('on')
  .transform((v) => v === 'on');

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_URL: z.string().url().default('http://localhost:4000'),
  INTERNAL_TOKEN: z.string().min(1),
  FEED_BINANCE: onOff,
  FEED_SYNTHETIC: onOff,
  /** backfill candle history on boot (Binance klines / synthetic history) */
  CANDLE_BACKFILL: onOff,
  /** a (symbol, tf) with fewer closed bars than this gets backfilled */
  CANDLE_BACKFILL_MIN_BARS: z.coerce.number().int().positive().default(200),
  /** bars fetched/generated per tf when backfilling */
  CANDLE_BACKFILL_BARS: z.coerce.number().int().positive().max(5000).default(1500),
  /** how often the in-memory trading index is rebuilt from the API (ms) */
  INDEX_REFRESH_MS: z.coerce.number().int().positive().default(5000),
  /** the risk loop runs account snapshots at this cadence (ms) */
  ACCOUNT_LOOP_MS: z.coerce.number().int().positive().default(500),
  /** set to off to run feeds+candles without the risk loop (API not up yet) */
  RISK_ENGINE: onOff,
  SWAP_CRON: onOff,
});

export type WorkerConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`worker config invalid: ${issues}`);
  }
  return parsed.data;
}
