ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Everyone who already exists has effectively been using Z: no welcome for them.
UPDATE "users" SET "onboarded_at" = "created_at" WHERE "onboarded_at" IS NULL;
