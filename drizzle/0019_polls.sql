-- Polls (docs/polls.md): options and closing time on the post, one vote per person.
CREATE TABLE "poll_votes" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "poll_options" text[];--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "poll_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "poll_votes_active_uq" ON "poll_votes" USING btree ("post_id","user_id") WHERE "poll_votes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "poll_votes_updated_at_idx" ON "poll_votes" USING btree ("updated_at");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_poll_ck" CHECK (("posts"."poll_options" is null) = ("posts"."poll_ends_at" is null));--> statement-breakpoint
CREATE TRIGGER poll_votes_set_updated_at BEFORE UPDATE ON "poll_votes" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
