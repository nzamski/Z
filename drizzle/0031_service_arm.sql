-- The arm (ground / air / navy): rank insignia differ between them (public/ranks/<arm>/).
ALTER TABLE "users" ADD COLUMN "service_arm" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_service_arm_ck" CHECK (service_arm in ('ground', 'air', 'navy'));