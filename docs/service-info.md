# Service details

Optional profile fields with their own "פרטי שירות" section on the profile, between the profile
header and the experience, and their own edit popup (not "edit profile", not the first-login
welcome); visible to every logged-in user. The rank's insignia also sits beside the name in the
header. Code: `lib/service-info.ts` (lists, labels, checks), `updateServiceInfo` in
`lib/services.ts`, `components/service-section.tsx`, `service-editor.tsx` and
`service-fields.tsx`.

| Field         | Column          | Rule                                                              |
| ------------- | --------------- | ----------------------------------------------------------------- |
| Rank          | `rank`          | one of `RANKS` (DB check `users_rank_ck`), or none                |
| Service type  | `service_type`  | one of `SERVICE_TYPES` (`users_service_type_ck`), or none         |
| Arm           | `service_arm`   | ground / air / navy (`SERVICE_ARMS`); picks the rank insignia set |
| Service start | `service_start` | a date, not in the future, within 60 years                        |
| Service end   | `service_end`   | a date after the start, up to 40 years ahead                      |

Days in service (פז״ם) are computed from the start date, and days left to the release from the
end date (shown only while it is ahead), when the page renders; never stored.
A blank field clears it; a field the form doesn't send is left alone. All checks run in the
service layer (`updateProfile`); the form's browser checks are a convenience.

Base / location moved to each experience role (`docs/experience.md`) on 2026-10-22; `users.location`
is no longer used and stays until a later migration, so a rollback still works.

Ranks show as their official insignia (`components/rank-insignia.tsx`), one set per arm in
`public/ranks/<arm>/` (sources and licenses: `public/ranks/ATTRIBUTION.md`; fetched by
`scripts/fetch-rank-insignia.sh`). No arm set: the ground forces' insignia.

Birth date / age was dropped on 2026-10-22: `users.birth_date` is no longer used and stays until a
later migration, so a rollback still works.

Adding a rank or service type: list it in `lib/service-info.ts`, then `npm run db:generate`
(the DB checks are built from the lists).

Not done: admins can't edit these for someone else, and nothing is verified (a user can claim any
rank).

Civilian phone and email were dropped on 2026-10-23: `users.civic_phone` and `users.civic_email`
are no longer used and stay until a later migration, so a rollback still works.
