-- Moderation: admins, an append-only audit log, moderator removals (removed_at, set
-- with deleted_at) and user suspension. docs/moderation.md.
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"granted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"actor_id" uuid,
	"action" text NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"user_id" uuid,
	"reason" text NOT NULL,
	"detail" text,
	CONSTRAINT "moderation_actions_action_ck" CHECK (action in ('remove_post', 'restore_post', 'remove_comment', 'restore_comment', 'suspend_user', 'unsuspend_user', 'clear_bio', 'reset_handle', 'grant_admin', 'revoke_admin')),
	CONSTRAINT "moderation_actions_one_target_ck" CHECK (num_nonnulls("moderation_actions"."post_id", "moderation_actions"."comment_id", "moderation_actions"."user_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admins" ADD CONSTRAINT "admins_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admins_user_active_uq" ON "admins" USING btree ("user_id") WHERE "admins"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "admins_updated_at_idx" ON "admins" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_log_idx" ON "moderation_actions" USING btree ("created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "moderation_actions_updated_at_idx" ON "moderation_actions" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER admins_set_updated_at BEFORE UPDATE ON "admins" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
CREATE TRIGGER moderation_actions_set_updated_at BEFORE UPDATE ON "moderation_actions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
