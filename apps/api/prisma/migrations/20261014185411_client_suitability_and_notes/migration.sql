-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "annual_income" TEXT,
ADD COLUMN     "employment_status" TEXT,
ADD COLUMN     "expected_deposit" TEXT,
ADD COLUMN     "net_worth" TEXT,
ADD COLUMN     "source_of_funds" TEXT,
ADD COLUMN     "trading_experience" TEXT,
ADD COLUMN     "trading_objective" TEXT;

-- CreateTable
CREATE TABLE "client_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_notes_user_id_created_at_idx" ON "client_notes"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
