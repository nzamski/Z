-- Likes on comments; comments.author_liked_at marks the ones the post's author liked.
CREATE TABLE "comment_likes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "author_liked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_likes_active_uq" ON "comment_likes" USING btree ("user_id","comment_id") WHERE "comment_likes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "comment_likes_rate_idx" ON "comment_likes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_likes_updated_at_idx" ON "comment_likes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "comments_author_liked_idx" ON "comments" USING btree ("post_id") WHERE "comments"."author_liked_at" is not null and "comments"."deleted_at" is null;--> statement-breakpoint
CREATE TRIGGER comment_likes_set_updated_at BEFORE UPDATE ON "comment_likes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
