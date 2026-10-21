-- Pins move from one per user (users.pinned_post_id, 0017) to a post's own pinned_at: up to
-- PINS_MAX pinned posts per profile (lib/services.ts pinPost). Existing pins are carried over.
ALTER TABLE "posts" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
UPDATE "posts" SET "pinned_at" = now() FROM "users" WHERE "users"."pinned_post_id" = "posts"."id";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_pinned_post_id_posts_id_fk";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "pinned_post_id";--> statement-breakpoint
CREATE INDEX "posts_pinned_idx" ON "posts" USING btree ("author_id","pinned_at") WHERE "posts"."pinned_at" is not null and "posts"."deleted_at" is null;
