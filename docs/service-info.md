# Service details

Optional profile fields, picked by each user in "edit profile" (not in the first-login welcome)
and shown on their profile to every logged-in user. Code: `lib/service-info.ts` (lists, labels,
checks), `components/service-fields.tsx` (form), `components/service-details.tsx` (profile).

| Field          | Column          | Rule                                                              |
| -------------- | --------------- | ----------------------------------------------------------------- |
| Rank           | `rank`          | one of `RANKS` (DB check `users_rank_ck`), or none                |
| Service type   | `service_type`  | one of `SERVICE_TYPES` (`users_service_type_ck`), or none         |
| Service start  | `service_start` | a date, not in the future, within 60 years                        |
| Service end    | `service_end`   | a date after the start, up to 40 years ahead                      |
| Birth date     | `birth_date`    | a date giving an age of 14 to 100; the profile shows the age only |
| Civilian phone | `civic_phone`   | digits, optional leading `+`, spaces and dashes; 7-15 digits      |
| Civilian email | `civic_email`   | `x@y.z`, lowercased, up to 254 characters                         |

Days in service (פז״ם) are computed from the start date, and days left to the release from the
end date (shown only while it is ahead), when the page renders; never stored.
A blank field clears it; a field the form doesn't send is left alone. All checks run in the
service layer (`updateProfile`); the form's browser checks are a convenience.

Base / location moved to each experience role (`docs/experience.md`) on 2026-10-22; `users.location`
is no longer used and stays until a later migration, so a rollback still works.

Adding a rank or service type: list it in `lib/service-info.ts`, then `npm run db:generate`
(the DB checks are built from the lists).

Not done: admins can't edit these for someone else, and nothing is verified (a user can claim any
rank). Phone and email are personal data visible to everyone logged in: see
`docs/security-notes.md`.
