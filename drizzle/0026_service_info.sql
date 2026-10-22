-- Service details on profiles (lib/service-info.ts, docs/service-info.md): rank, service type,
-- service start date, location, civilian phone and email. And the Team Lead profession badge.
ALTER TABLE "users" DROP CONSTRAINT "users_profession_ck";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rank" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "service_type" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "service_start" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "civic_phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "civic_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_rank_ck" CHECK (rank in ('private', 'corporal', 'sergeant', 'staff_sergeant', 'sergeant_first_class', 'master_sergeant', 'sergeant_major', 'warrant_officer', 'chief_warrant_officer', 'second_lieutenant', 'lieutenant', 'captain', 'major', 'lieutenant_colonel', 'colonel', 'brigadier_general', 'major_general', 'lieutenant_general'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_service_type_ck" CHECK (service_type in ('regular', 'career', 'reserves', 'civilian'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_profession_ck" CHECK (profession in ('developer', 'devops', 'data_engineer', 'data_scientist', 'qa', 'data_analyst', 'ml_engineer', 'architect', 'product_manager', 'ux_ui', 'cyber', 'team_lead'));