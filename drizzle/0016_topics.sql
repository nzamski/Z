-- #topics (lib/tags.ts, docs/topics.md): post_tags from a post's #tags, topic_follows.
CREATE TABLE "post_tags" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"post_id" uuid NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_follows" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"tag" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_follows" ADD CONSTRAINT "topic_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_tags_active_uq" ON "post_tags" USING btree ("post_id","tag") WHERE "post_tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "post_tags_tag_idx" ON "post_tags" USING btree ("tag") WHERE "post_tags"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "post_tags_updated_at_idx" ON "post_tags" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_follows_active_uq" ON "topic_follows" USING btree ("user_id","tag") WHERE "topic_follows"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "topic_follows_updated_at_idx" ON "topic_follows" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER post_tags_set_updated_at BEFORE UPDATE ON "post_tags" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER topic_follows_set_updated_at BEFORE UPDATE ON "topic_follows" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
