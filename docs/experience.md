# Experience

A LinkedIn-style "ניסיון" section on profiles: one row per role in `experiences`, the owner's to
add, edit and delete (everyone logged in can read it). Code: `lib/experience.ts` (limits, month
math, Hebrew durations), `experienceOf` / `saveExperience` / `deleteExperience` in
`lib/services.ts`, `components/experience-section.tsx` (profile) and
`components/experience-editor.tsx` (the add/edit dialog).

| Field        | Column         | Rule                                                   |
| ------------ | -------------- | ------------------------------------------------------ |
| Role         | `title`        | required, up to 60 characters                          |
| Organization | `organization` | optional (unit, team, company), up to 60               |
| Start        | `start_month`  | a month, not in the future (stored as its first day)   |
| End          | `end_month`    | a month from the start up to this month; none: current |

`description` is no longer used (dropped from the form 2026-10-22); the column stays until a later
migration, so a rollback to the previous version still works.

Order: current roles first, then by end and start, newest first. Length counts both months
(January to March is 3 months) and runs to this month for a current role. At most 30 roles a
person (`experience_limit`). Deleting is a soft delete, like everything else.

Not done: moderators can't remove a role (they can suspend the person or clear the bio); the
month input is a native `<input type="month">`, which Firefox shows as a text field.
