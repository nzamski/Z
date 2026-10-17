DROP INDEX "posts_feed_idx";--> statement-breakpoint
DROP INDEX "posts_author_idx";--> statement-breakpoint
CREATE INDEX "posts_feed_idx" ON "posts" USING btree ("created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_author_idx" ON "posts" USING btree ("author_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "posts"."deleted_at" is null;