-- Rank removed (and the arm, which only picked its insignia): the service details section was
-- dropped. service_type / service_start / service_end stay unused for rollback.
ALTER TABLE "users" DROP CONSTRAINT "users_rank_ck";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_service_arm_ck";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_service_type_ck";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "rank";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "service_arm";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_service_type_ck" CHECK ("users"."service_type" in ('regular', 'career', 'reserves', 'civilian'));