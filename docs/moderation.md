# Moderation

Admins can remove and restore posts and comments, suspend users, clear bios and reset handles.
Every action needs a reason and is written to an append-only audit log. Added 2026-10-19 at the user's request.

Code: services in `lib/services.ts` (section "moderation"), actions in `app/actions.ts`, page
`app/admin/page.tsx`, control `components/moderate-button.tsx`, CLI `scripts/admin.mjs`, schema
in `db/schema.ts` and `drizzle/0010_moderation.sql`.

## Who is an admin

A row in `admins` (one active row per user; revoking soft-deletes it). The check runs on every
request against the database, never from the session cookie, so a revoke takes effect at once.

- **First admin**: from the command line, with access to the database:

  ```sh
  # in the cluster (same image, same env as the app)
  oc exec deploy/z -- node admin.mjs grant <handle> "<reason>"
  oc exec deploy/z -- node admin.mjs list
  oc exec deploy/z -- node admin.mjs revoke <handle> "<reason>"
  # locally
  node --env-file=.env scripts/admin.mjs grant dana "first admin"
  ```

  The user must have logged in once and picked a handle. Command-line actions are logged with
  no actor ("command line" on `/admin`).

- **After that**: admins grant and revoke each other on `/admin`. Nobody can revoke themselves,
  so there is always at least one admin (the command line can still revoke anyone).
- `npm run seed` makes `dana` an admin, so moderation can be tried right after seeding.

## What admins can do

| Action         | Where                           | Effect                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remove post    | post page                       | Soft delete (`deleted_at`) plus `removed_at`. Gone from feeds and search; the page says "removed by a moderator".                                                                                                                                                                 |
| Remove comment | under the comment               | Same; the thread shows "[removed by a moderator]" if it has replies. `posts.comment_count` drops by one, as for a delete.                                                                                                                                                         |
| Restore        | `/admin` log, removed post page | Only undoes a moderator removal; an author's own delete stays deleted.                                                                                                                                                                                                            |
| Suspend        | profile, `/admin`               | `users.suspended_at`: locked out. Every page sends them to `/suspended`; every write (including deletes, unlikes, unfollows) is refused in the service layer; page titles show nothing. Their existing content stays visible to others. Admins can't be suspended (revoke first). |
| Clear bio      | profile                         | Bio set to empty; the old bio is kept in the log.                                                                                                                                                                                                                                 |
| Reset handle   | profile                         | Handle replaced with a placeholder (`u_` + 10 hex chars) and the user goes back through the welcome to pick a new one. The old handle is kept in the log and is free again.                                                                                                       |
| Grant / revoke | `/admin`, CLI                   | Adds or soft-deletes the `admins` row.                                                                                                                                                                                                                                            |

Admins don't see moderator controls on their own content: they use the normal edit and delete.
An admin can still read a removed post on its page (to review it before restoring); everyone
else sees only the notice.

## The audit log

`moderation_actions`: actor (null = command line), action, exactly one target (post, comment or
user), reason (1 to 300 characters), and `detail` (the old bio or handle). Each action and its
log row are written in one transaction; a no-op (suspending a suspended user) writes nothing.
Rows are never edited or deleted. `/admin` shows the newest 100.

## What is not here

- No reports or flags from users: admins find content themselves.
- No notification to the affected user, other than what they see (the notice, the welcome).
- No bulk actions, no "remove all posts by this user".
- Login events and ordinary edits are not audited (`docs/security-notes.md`).
