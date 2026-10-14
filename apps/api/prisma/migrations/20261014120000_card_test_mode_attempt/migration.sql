-- Card deposit attempts run in deterministic TEST MODE while no payment gateway is connected:
-- every attempt is recorded and immediately declined. This flag marks such rows so they are
-- distinguishable from real admin/gateway declines in the same table.
ALTER TABLE "payment_requests" ADD COLUMN "test_mode" BOOLEAN NOT NULL DEFAULT false;
