-- Experience on profiles (docs/experience.md): one row per role, soft-deleted like everything else.
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"organization" text DEFAULT '' NOT NULL,
	"start_month" date NOT NULL,
	"end_month" date,
	"description" text DEFAULT '' NOT NULL,
	CONSTRAINT "experiences_months_ck" CHECK ("experiences"."end_month" is null or "experiences"."end_month" >= "experiences"."start_month")
);
--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiences_user_idx" ON "experiences" USING btree ("user_id") WHERE "experiences"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "experiences_updated_at_idx" ON "experiences" USING btree ("updated_at");--> statement-breakpoint
CREATE TRIGGER experiences_set_updated_at BEFORE UPDATE ON "experiences" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
