-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_seen_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_events_created_at_idx" ON "activity_events"("created_at");

-- CreateIndex
CREATE INDEX "activity_events_user_id_idx" ON "activity_events"("user_id");

-- CreateIndex
CREATE INDEX "activity_events_kind_idx" ON "activity_events"("kind");

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
