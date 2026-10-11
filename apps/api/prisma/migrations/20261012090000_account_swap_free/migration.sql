-- admin-controlled swap-free accounts (no overnight swap charges)
ALTER TABLE "trading_accounts" ADD COLUMN IF NOT EXISTS "swap_free" BOOLEAN NOT NULL DEFAULT false;
