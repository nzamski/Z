-- Generated avatars (lib/avatar.ts): every user gets a random seed, existing ones included; the
-- profile form's shuffle replaces it. The set_updated_at() trigger advances updated_at.
ALTER TABLE "users" ALTER COLUMN "avatar_seed" SET DEFAULT substr(md5(random()::text), 1, 8);--> statement-breakpoint
UPDATE "users" SET "avatar_seed" = substr(md5(random()::text), 1, 8) WHERE "avatar_seed" = '';
