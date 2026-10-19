-- extra KYC/suitability fields captured at sign-up
ALTER TABLE "user_profiles"
  ADD COLUMN "job_role" TEXT,
  ADD COLUMN "job_role_other" TEXT,
  ADD COLUMN "us_citizen" TEXT,
  ADD COLUMN "pep" TEXT;
