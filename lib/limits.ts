// Text limits shared by the service layer (validation) and the composers (counter). No DB imports.
export const POST_MAX = 5_000; // PLAN.md says 20k; 5k for now at the user's request (2026-10-17)
export const COMMENT_MAX = 5_000;
export const BIO_MAX = 160;
