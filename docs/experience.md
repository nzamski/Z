# Experience

A LinkedIn-style "ניסיון" section on profiles: one row per role in `experiences`, the owner's to
add, edit and delete (everyone logged in can read it). Code: `lib/experience.ts` (limits, month
math, Hebrew durations), `experienceOf` / `saveExperience` / `deleteExperience` in
`lib/services.ts`, `components/experience-section.tsx` (profile) and
`components/experience-editor.tsx` (the add/edit dialog).

| Field    | Column        | Rule                                                            |
| -------- | ------------- | --------------------------------------------------------------- |
| Role     | `title`       | required, up to 60 characters                                   |
| Unit     | `unit`        | optional (called `organization` until migration 0033), up to 60 |
| Location | `location`    | optional (base or location of the role), up to 40               |
| Start    | `start_month` | a month, not in the future (stored as its first day)            |
| End      | `end_month`   | a month from the start up to this month; none: current          |

`description` is no longer used (dropped from the form 2026-10-22); the column stays until a later
migration, so a rollback to the previous version still works.

Order: current roles first, then by end and start, newest first. Length counts both months
(January to March is 3 months) and runs to this month for a current role. At most 30 roles a
person (`experience_limit`). Deleting is a soft delete, like everything else.

## Finding people by role and unit

- **Search** (`searchUsers`): the query also matches role titles and units (substring or close,
  like names; docs/search.md).
- **Unit page** (`/search?unit=<unit>`, `unitHref`): the unit on a profile's role links to everyone
  who has had a role there (`peopleInUnit`): an exact match ignoring case and surrounding spaces,
  people currently there first, then by when they left, then most followed.

- **Suggestions while typing** (`SuggestInput`, `components/suggest-input.tsx`): the role and unit
  fields offer values already in use (`experienceSuggestions`: containing the text, starting with
  it first, then by how many people use them), in a native `<datalist>`, so one unit keeps one
  spelling and the unit page finds everyone in it. Existing spellings are left as they are.

- **Not on user cards**: people lists, the sidebar's who to follow, post cards and the hover card
  don't show roles (removed 2026-10-26 at the user's request); only the profile's experience
  section does.

- **Welcome step** (`/welcome`, step 2 of 3): the current role (title, unit, location, start month), saved
  as a current role with `saveExperienceAction` (allowed before setup is finished). Skippable;
  on a reload it edits the role saved there instead of adding another.

Not done: moderators can't remove a role (they can suspend the person or clear the bio).
