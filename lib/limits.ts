// Text limits shared by the service layer (validation) and the composers (counter). No DB imports.
export const POST_MAX = 20_000; // PLAN.md §7 (was 500 from 2026-10-17 to 2026-10-19)
export const COMMENT_MAX = 10_000;
// Posts can be edited this long after they're published; comments can't be edited at all.
export const EDIT_WINDOW_MINUTES = 60;
export const REPORT_NOTE_MAX = 300; // the optional note on a report (docs/reports.md)
// The usage dashboard counts days in this time zone (docs/stats.md).
export const STATS_TIMEZONE = "Asia/Jerusalem";
export const BIO_MAX = 70;
// Handles: 3-15 chars, starting with a letter; then lowercase latin letters, digits and _.
// (Minimum 3 since 2026-10-20 at the user's request; it was 4.)
export const HANDLE_RE = /^[a-z][a-z0-9_]{2,14}$/;
export const HANDLE_MAX = 15;
export const REASON_MAX = 300; // moderation reasons
export const PINS_MAX = 3; // pinned posts per profile
// Polls (docs/polls.md): 2-4 short options, open from 5 minutes to 7 days (X's limits).
export const POLL_OPTIONS_MAX = 4;
export const POLL_OPTION_MAX = 25;
export const POLL_MINUTES = { min: 5, max: 7 * 24 * 60, default: 24 * 60 };

// Rate limits per user (docs/security-notes.md). Writes are counted in Postgres from the rows
// themselves, soft-deleted ones included, so they hold across replicas and store nothing new.
// Search is limited in memory per server process (lib/rate-limit.ts). Mutable for tests only.
export const RATE = {
  posts: { max: 30, minutes: 10 },
  comments: { max: 30, minutes: 10 },
  likes: { max: 120, minutes: 10 }, // likes rows: each re-like after an unlike counts
  commentLikes: { max: 120, minutes: 10 },
  follows: { max: 50, minutes: 10 },
  reports: { max: 10, minutes: 60 },
  search: { max: 30, minutes: 1 },
};
