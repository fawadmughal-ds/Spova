-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('client', 'admin', 'superadmin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('demo', 'live');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('enabled', 'disabled', 'readonly');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('classic', 'silver', 'gold', 'platinum', 'vip');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('deposit', 'withdraw', 'credit', 'debit', 'bonus', 'pnl', 'swap', 'fee', 'commission', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('deposit', 'withdraw');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'approved', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "KycGroup" AS ENUM ('poi', 'por', 'payment', 'other');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "AssetClass" AS ENUM ('forex', 'index', 'commodity', 'stock', 'crypto', 'metal');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('market', 'limit', 'stop');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'filled', 'cancelled', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "CloseReason" AS ENUM ('user', 'sl', 'tp', 'stopout', 'admin', 'expiry');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "Timeframe" AS ENUM ('m1', 'm5', 'm15', 'h1', 'h4', 'd1');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'client',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ,
    "kyc_poi" BOOLEAN NOT NULL DEFAULT false,
    "kyc_por" BOOLEAN NOT NULL DEFAULT false,
    "kyc_payment" BOOLEAN NOT NULL DEFAULT false,
    "tc_accepted_at" TIMESTAMPTZ,
    "risk_accepted_at" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "last_login_ip" TEXT,
    "referral_code" TEXT,
    "referred_by" UUID,
    "totp_secret" TEXT,
    "admin_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dob" DATE,
    "country_code" CHAR(2) NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "zip" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "notif_email" BOOLEAN NOT NULL DEFAULT true,
    "notif_sms" BOOLEAN NOT NULL DEFAULT false,
    "notif_push" BOOLEAN NOT NULL DEFAULT true,
    "notif_calls" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "AccountType" NOT NULL,
    "login_code" INTEGER NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'classic',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "leverage" INTEGER NOT NULL DEFAULT 100,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "AccountStatus" NOT NULL DEFAULT 'enabled',
    "trading_blocked" BOOLEAN NOT NULL DEFAULT false,
    "margin_call_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trading_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance_after" DECIMAL(18,2) NOT NULL,
    "credit_after" DECIMAL(18,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" UUID,
    "actor_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "destination" JSONB,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ,
    "ledger_entry_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "group" "KycGroup" NOT NULL,
    "doc_type" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbols" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset_class" "AssetClass" NOT NULL,
    "digits" INTEGER NOT NULL,
    "contract_size" DECIMAL(18,4) NOT NULL,
    "min_lot" DECIMAL(10,2) NOT NULL DEFAULT 0.01,
    "max_lot" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "lot_step" DECIMAL(10,2) NOT NULL DEFAULT 0.01,
    "leverage_max" INTEGER NOT NULL,
    "spread_markup" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "swap_long" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "swap_short" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "feed_source" TEXT NOT NULL,
    "feed_symbol" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "symbols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_sessions" (
    "id" SERIAL NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,

    CONSTRAINT "symbol_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symbol_holidays" (
    "symbol_id" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "symbol_holidays_pkey" PRIMARY KEY ("symbol_id","date")
);

-- CreateTable
CREATE TABLE "candles" (
    "symbol_id" TEXT NOT NULL,
    "tf" "Timeframe" NOT NULL,
    "t" TIMESTAMPTZ NOT NULL,
    "o" DECIMAL(18,6) NOT NULL,
    "h" DECIMAL(18,6) NOT NULL,
    "l" DECIMAL(18,6) NOT NULL,
    "c" DECIMAL(18,6) NOT NULL,
    "v" INTEGER,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("symbol_id","tf","t")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(18,6),
    "sl" DECIMAL(18,6),
    "tp" DECIMAL(18,6),
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "filled_price" DECIMAL(18,6),
    "filled_at" TIMESTAMPTZ,
    "position_id" UUID,
    "reject_reason" TEXT,
    "expires_at" TIMESTAMPTZ,
    "client_ref" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "symbol_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "open_price" DECIMAL(18,6) NOT NULL,
    "open_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sl" DECIMAL(18,6),
    "tp" DECIMAL(18,6),
    "margin_used" DECIMAL(18,2) NOT NULL,
    "swap_accrued" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'open',
    "close_price" DECIMAL(18,6),
    "close_at" TIMESTAMPTZ,
    "realized_pnl" DECIMAL(18,2),
    "close_reason" "CloseReason",
    "closed_by" UUID,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_closes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "position_id" UUID NOT NULL,
    "lots" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "pnl" DECIMAL(18,2) NOT NULL,
    "reason" "CloseReason" NOT NULL,
    "ledger_entry_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_configs" (
    "tier" "Tier" NOT NULL,
    "margin_call_pct" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "stop_out_pct" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "default_leverage" INTEGER NOT NULL DEFAULT 100,
    "max_leverage" INTEGER NOT NULL DEFAULT 400,
    "min_deposit" DECIMAL(18,2) NOT NULL DEFAULT 150,
    "spread_discount_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "risk_configs_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "assigned_to" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_exports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "file_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statement_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trading_accounts_login_code_key" ON "trading_accounts"("login_code");

-- CreateIndex
CREATE INDEX "trading_accounts_user_id_idx" ON "trading_accounts"("user_id");

-- CreateIndex
CREATE INDEX "trading_accounts_type_status_idx" ON "trading_accounts"("type", "status");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_created_at_idx" ON "ledger_entries"("created_at");

-- CreateIndex
CREATE INDEX "payment_requests_status_created_at_idx" ON "payment_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "payment_requests_user_id_idx" ON "payment_requests"("user_id");

-- CreateIndex
CREATE INDEX "kyc_documents_user_id_idx" ON "kyc_documents"("user_id");

-- CreateIndex
CREATE INDEX "kyc_documents_status_created_at_idx" ON "kyc_documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "symbols_asset_class_enabled_idx" ON "symbols"("asset_class", "enabled");

-- CreateIndex
CREATE INDEX "symbol_sessions_symbol_id_weekday_idx" ON "symbol_sessions"("symbol_id", "weekday");

-- CreateIndex
CREATE INDEX "orders_account_id_status_idx" ON "orders"("account_id", "status");

-- CreateIndex
CREATE INDEX "orders_symbol_id_status_idx" ON "orders"("symbol_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_account_id_client_ref_key" ON "orders"("account_id", "client_ref");

-- CreateIndex
CREATE INDEX "positions_account_id_status_idx" ON "positions"("account_id", "status");

-- CreateIndex
CREATE INDEX "positions_symbol_id_status_idx" ON "positions"("symbol_id", "status");

-- CreateIndex
CREATE INDEX "position_closes_position_id_idx" ON "position_closes"("position_id");

-- CreateIndex
CREATE INDEX "tickets_status_updated_at_idx" ON "tickets"("status", "updated_at");

-- CreateIndex
CREATE INDEX "tickets_user_id_idx" ON "tickets"("user_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages"("ticket_id");

-- CreateIndex
CREATE INDEX "admin_audit_created_at_idx" ON "admin_audit"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_target_type_target_id_idx" ON "admin_audit"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_audit_actor_id_idx" ON "admin_audit"("actor_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "statement_exports_account_id_idx" ON "statement_exports"("account_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_accounts" ADD CONSTRAINT "trading_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_sessions" ADD CONSTRAINT "symbol_sessions_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symbol_holidays" ADD CONSTRAINT "symbol_holidays_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles" ADD CONSTRAINT "candles_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_symbol_id_fkey" FOREIGN KEY ("symbol_id") REFERENCES "symbols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_closes" ADD CONSTRAINT "position_closes_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_exports" ADD CONSTRAINT "statement_exports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "trading_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
