// Text limits shared by the service layer (validation) and the composers (counter). No DB imports.
export const POST_MAX = 20_000; // PLAN.md §7 (was 500 from 2026-10-17 to 2026-10-19)
export const COMMENT_MAX = 10_000;
export const BIO_MAX = 70;
// Handles: 4-15 chars, starting with a letter; then lowercase latin letters, digits and _.
export const HANDLE_RE = /^[a-z][a-z0-9_]{3,14}$/;
export const HANDLE_MAX = 15;
export const REASON_MAX = 300; // moderation reasons

// Rate limits per user (docs/security-notes.md). Writes are counted in Postgres from the rows
// themselves, soft-deleted ones included, so they hold across replicas and store nothing new.
// Search is limited in memory per server process (lib/rate-limit.ts). Mutable for tests only.
export const RATE = {
  posts: { max: 10, minutes: 10 },
  comments: { max: 30, minutes: 10 },
  likes: { max: 120, minutes: 10 }, // likes rows: each re-like after an unlike counts
  follows: { max: 50, minutes: 10 },
  search: { max: 30, minutes: 1 },
};
