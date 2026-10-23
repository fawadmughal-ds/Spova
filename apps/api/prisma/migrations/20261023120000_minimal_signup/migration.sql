-- Sign-up is now minimal; country is collected later in onboarding, so it must allow NULL.
ALTER TABLE "user_profiles" ALTER COLUMN "country_code" DROP NOT NULL;
