-- AlterTable
ALTER TABLE "users" ADD COLUMN "kyc_deadline_at" TIMESTAMPTZ,
ADD COLUMN "kyc_frozen_at" TIMESTAMPTZ,
ADD COLUMN "kyc_reminder_sent_at" TIMESTAMPTZ;

-- existing clients get the same 15-day window from now
UPDATE "users" SET "kyc_deadline_at" = NOW() + INTERVAL '15 days' WHERE "role" = 'client' AND "kyc_deadline_at" IS NULL;
