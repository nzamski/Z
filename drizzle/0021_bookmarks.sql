-- Bookmarks (saved posts and comments), private to their user.
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	CONSTRAINT "bookmarks_one_ck" CHECK (("bookmarks"."post_id" is null) <> ("bookmarks"."comment_id" is null))
);
--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_post_active_uq" ON "bookmarks" USING btree ("user_id","post_id") WHERE "bookmarks"."deleted_at" is null and "bookmarks"."post_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_comment_active_uq" ON "bookmarks" USING btree ("user_id","comment_id") WHERE "bookmarks"."deleted_at" is null and "bookmarks"."comment_id" is not null;--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "bookmarks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "bookmarks_updated_at_idx" ON "bookmarks" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER bookmarks_set_updated_at BEFORE UPDATE ON "bookmarks" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
