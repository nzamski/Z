-- "Organization" is "unit" now (2026-10-24, at the user's request). Not rollback-safe: the previous
-- version reads "organization", so roll back the image together with this migration.
ALTER TABLE "experiences" RENAME COLUMN "organization" TO "unit";