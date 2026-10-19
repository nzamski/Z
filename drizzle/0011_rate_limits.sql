-- Rate limits (RATE in lib/limits.ts): count a user's recent rows, soft-deleted ones included.
CREATE INDEX "comments_rate_idx" ON "comments" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "follows_rate_idx" ON "follows" USING btree ("follower_id","created_at");--> statement-breakpoint
CREATE INDEX "likes_rate_idx" ON "likes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_rate_idx" ON "posts" USING btree ("author_id","created_at");