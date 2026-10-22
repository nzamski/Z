// Report reasons (docs/reports.md). No DB imports: the report popup uses them too; db/schema.ts
// builds the reports_reason_ck check from this list (changing it needs a migration).
export const REPORT_REASONS = ["spam", "abuse", "misleading", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
