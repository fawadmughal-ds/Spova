-- AlterTable
ALTER TABLE "payment_requests" ADD COLUMN "proof_key" TEXT,
ADD COLUMN "proof_name" TEXT,
ADD COLUMN "proof_mime" TEXT;

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
