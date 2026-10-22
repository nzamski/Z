-- "Poll ended" notifications (written on the next check: notifyEndedPolls).
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_ck";--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_poll_ended_uq" ON "notifications" USING btree ("recipient_id","post_id") WHERE "notifications"."type" = 'poll_ended';--> statement-breakpoint
CREATE INDEX "posts_poll_ends_idx" ON "posts" USING btree ("poll_ends_at") WHERE "posts"."poll_ends_at" is not null;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_ck" CHECK (type in ('comment', 'reply', 'author_liked', 'like_post', 'like_comment', 'follow', 'mention_post', 'mention_comment', 'removed_post', 'removed_comment', 'restored_post', 'restored_comment', 'poll_ended'));