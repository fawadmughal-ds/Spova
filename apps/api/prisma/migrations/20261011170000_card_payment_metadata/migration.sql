-- safe card metadata for card deposits (never the full number or CVV)
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "card_brand" TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "card_last4" VARCHAR(4);
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "card_name" TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "provider_code" TEXT;
ALTER TABLE "payment_requests" ADD COLUMN IF NOT EXISTS "provider_customer_id" TEXT;
