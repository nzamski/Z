# Reports

Added 2026-10-22. Code: `reportContent`, `openReports`, `openReportCount`, `dismissReports` in
`lib/services.ts` (section "reports"); popup `components/report-button.tsx`; queue on
`app/admin/page.tsx`; reasons `lib/reports.ts`; table `drizzle/0023_reports_and_visits.sql`.

## Reporting

- "Report" (דיווח) is in the `⋯` menu of every post and comment that isn't yours.
- Pick a reason (spam, offensive/harassing, misleading, other) and optionally add a note (up to
  300 characters). A thank-you closes it.
- One open report per person and item: reporting again while it's open does nothing. After an
  admin closes it, you can report the item again.
- Rate limited (`RATE.reports`: 10 an hour). Suspended users can't report.

## Admins

- The item's **first** open report notifies every admin (type `report`, actor = the reporter).
- The admin link (rail) and the account menu (header) show the number of reported items.
- `/admin` starts with **Reports**: one entry per item (newest report first) with its text, its
  author, and each report's reason, note and reporter. Admins see who reported; the reported
  user never does.
- **Remove** the item: the usual moderator removal (with a reason, notifying the author); it
  closes the item's open reports as `removed`.
- **Dismiss**: closes them as `dismissed`, with a reason, logged as `dismiss_reports`.
- Items deleted by their author (or removed) drop out of the queue on their own.

Reports are never deleted; resolved ones keep who closed them, how, and the log entry.
