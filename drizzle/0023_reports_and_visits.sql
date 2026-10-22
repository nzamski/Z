-- Reports of posts and comments (docs/reports.md) and daily visits for the usage dashboard
-- (docs/stats.md). Also widens the moderation action and notification type lists.
CREATE TABLE "daily_visits" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"reporter_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"reason" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"moderation_action_id" uuid,
	CONSTRAINT "reports_one_target_ck" CHECK (num_nonnulls("reports"."post_id", "reports"."comment_id") = 1),
	CONSTRAINT "reports_reason_ck" CHECK (reason in ('spam', 'abuse', 'misleading', 'other')),
	CONSTRAINT "reports_resolution_ck" CHECK (resolution is null or resolution in ('removed', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "moderation_actions" DROP CONSTRAINT "moderation_actions_action_ck";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_ck";--> statement-breakpoint
ALTER TABLE "daily_visits" ADD CONSTRAINT "daily_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderation_action_id_moderation_actions_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_visits_user_day_uq" ON "daily_visits" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "daily_visits_day_idx" ON "daily_visits" USING btree ("day");--> statement-breakpoint
CREATE INDEX "daily_visits_updated_at_idx" ON "daily_visits" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_post_uq" ON "reports" USING btree ("reporter_id","post_id") WHERE "reports"."resolved_at" is null and "reports"."deleted_at" is null and "reports"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_comment_uq" ON "reports" USING btree ("reporter_id","comment_id") WHERE "reports"."resolved_at" is null and "reports"."deleted_at" is null and "reports"."comment_id" is not null;--> statement-breakpoint
CREATE INDEX "reports_open_idx" ON "reports" USING btree ("created_at" DESC NULLS FIRST) WHERE "reports"."resolved_at" is null and "reports"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "reports_rate_idx" ON "reports" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "reports_updated_at_idx" ON "reports" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_action_ck" CHECK (action in ('remove_post', 'restore_post', 'remove_comment', 'restore_comment', 'suspend_user', 'unsuspend_user', 'clear_bio', 'reset_handle', 'grant_admin', 'revoke_admin', 'dismiss_reports'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_ck" CHECK (type in ('comment', 'reply', 'author_liked', 'like_post', 'like_comment', 'follow', 'mention_post', 'mention_comment', 'removed_post', 'removed_comment', 'restored_post', 'restored_comment', 'poll_ended', 'report'));--> statement-breakpoint
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON "reports" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER daily_visits_set_updated_at BEFORE UPDATE ON "daily_visits" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
