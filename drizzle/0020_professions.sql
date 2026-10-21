-- Profession badges (lib/professions.ts): one per user, optional.
ALTER TABLE "users" ADD COLUMN "profession" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_profession_ck" CHECK ("users"."profession" in ('developer', 'devops', 'data_engineer', 'data_scientist', 'qa', 'data_analyst'));