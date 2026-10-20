-- Notifications (lib/services.ts, docs/notifications.md).
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"recipient_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" text NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"moderation_action_id" uuid,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_type_ck" CHECK (type in ('comment', 'reply', 'author_liked', 'like_post', 'like_comment', 'follow', 'mention_post', 'mention_comment', 'removed_post', 'removed_comment', 'restored_post', 'restored_comment'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_moderation_action_id_moderation_actions_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("recipient_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST) WHERE "notifications"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("recipient_id") WHERE "notifications"."read_at" is null and "notifications"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER notifications_set_updated_at BEFORE UPDATE ON "notifications" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
