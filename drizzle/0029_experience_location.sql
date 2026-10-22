-- Base / location per experience role (moved off the profile; users.location is no longer used).
ALTER TABLE "experiences" ADD COLUMN "location" text DEFAULT '' NOT NULL;