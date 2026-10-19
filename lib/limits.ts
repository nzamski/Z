// Text limits shared by the service layer (validation) and the composers (counter). No DB imports.
export const POST_MAX = 500; // PLAN.md says 20k; 500 for now at the user's request (2026-10-17)
export const COMMENT_MAX = 5_000;
export const BIO_MAX = 70;
// Handles: 4-15 chars, starting with a letter; then lowercase latin letters, digits and _.
export const HANDLE_RE = /^[a-z][a-z0-9_]{3,14}$/;
export const HANDLE_MAX = 15;
export const REASON_MAX = 300; // moderation reasons
