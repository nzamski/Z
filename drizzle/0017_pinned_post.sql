-- A post pinned to its author's profile (lib/services.ts: pinPost, unpinPost, pinnedPost).
ALTER TABLE "users" ADD COLUMN "pinned_post_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_pinned_post_id_posts_id_fk" FOREIGN KEY ("pinned_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;