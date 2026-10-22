-- pg_trgm (confirmed available 2026-10-19): substring and fuzzy people search, and a
-- typo-tolerant fallback for post search (docs/search.md). pg_trgm is a trusted extension, so the
-- database owner can create it; if the DBA already has, this is a no-op.
-- Hebrew needs a UTF-8 aware LC_CTYPE (e.g. C.UTF-8, he_IL.UTF-8): under plain "C" pg_trgm skips
-- Hebrew letters and the fuzzy matches find nothing (ILIKE substring matching still works).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "posts_body_trgm_idx" ON "posts" USING gin ("body" gin_trgm_ops) WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "users_handle_trgm_idx" ON "users" USING gin ("handle" gin_trgm_ops) WHERE "users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "users_display_name_trgm_idx" ON "users" USING gin ("display_name" gin_trgm_ops) WHERE "users"."deleted_at" is null;