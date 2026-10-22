# Z

Internal professional social network (Hebrew, RTL).

@AGENTS.md

## Constraints (non-negotiable)

- **Air-gapped**: no CDN assets, no Google Fonts (fonts are local via `next/font/local`), no analytics, `NEXT_TELEMETRY_DISABLED=1`, no runtime calls to external hosts, nothing Vercel-specific.
- **Offline delivery**: ships as OCI images; the target network never runs `npm install`.
- **Minimal deps**: every new package needs a one-line justification in the commit/PR. Lockfile is committed.
- **Auth**: Keycloak OIDC (code + PKCE, confidential client) via `openid-client`; encrypted `HttpOnly`/`Secure`/`SameSite=Lax` cookie session via `jose`. `AuthProvider` interface: `KeycloakProvider` + dev user switcher (disabled when `NODE_ENV=production`). Users keyed on `keycloak_sub`; no passwords stored.
- **Sync readiness**: every table has UUIDv7 `id`, `created_at`, `updated_at`, `deleted_at`, and an index on `updated_at`. All deletes are soft, through the service layer. Reads filter `deleted_at IS NULL`. `updated_at` changes on every write; the shared `set_updated_at()` trigger is the backstop. Never hard-delete, never add a purge job.
- **RTL**: use logical Tailwind utilities (`ms-`, `ps-`, `text-start`), never `ml-`/`pl-`/`text-left`. All strings go in `lib/i18n/he.ts`.
- **Security review is required** before real deployment. Never claim production readiness.
- Postgres everywhere (no SQLite). Never commit secrets or real personal data; seed data is fictional.

## Data conventions

- Tables are plural (`users`, `posts`, `comments`, `likes`, `comment_likes`, `follows`, `admins`, `moderation_actions`, `notifications`, `reports`, `daily_visits`): `user`/`like` are reserved words.
- A new table needs: the `base` columns from `db/schema.ts`, an `updated_at` index, and a `CREATE TRIGGER ... set_updated_at()` in its migration. `tests/trigger.test.ts` lists every table; add it there.
- Writes go through `lib/services.ts` and throw `ServiceError` (`invalid` / `not_found` / `forbidden` / `gone` / `taken` / `suspended` / `rate_limited`). Every user write calls `assertCanWrite(actorId, kind?)` (suspension; with `kind`, also the per-user rate limit, `RATE` in `lib/limits.ts`).
- Auth: `lib/auth/` (`AuthProvider`: Keycloak or dev switcher at `/dev/login`). Dev Keycloak users `dana`/`yossi`/`noa` (password = username) have fixed ids that the seed reuses as `keycloak_sub`; `newbie` has no seeded row, so logging in as it shows the first-login welcome. Claim mapping lives in `finishLogin` (`lib/auth/keycloak.ts`).
- Server Actions (`app/actions.ts`) only check the session and input shape, call a service, then `refresh()`. Anything that reads cookies or the DB sits under `<Suspense>` after `await connection()`; route handlers that call out at request time also `await connection()` so `next build` never contacts the DB or Keycloak.
- Don't run `next build` while `next dev` is running; it overwrites `.next` and dev serves stale CSS. Edits to `app/globals.css` sometimes don't hot-reload either: check the served CSS, and restart `next dev` if the rule is missing. If pages keep reloading themselves in dev (HMR "rebuilding" loop), stop `next dev`, `rm -rf .next`, and start it again.
- Drizzle's postgres-js driver returns raw-SQL timestamps as strings; compare them in SQL.
- Changes at the user's request (2026-10-17): posts max 500 chars (back to 20,000 on 2026-10-19; comments 10,000; `lib/limits.ts`); users have no `unit`/`role_title` (dropped in migration 0004); bio max 70; Keycloak provides only `sub` and the display name (not editable). Handles are 3-15 characters (`HANDLE_RE`; minimum 3 since 2026-10-20). The handle is chosen by the user in the mandatory first-login welcome (`/welcome`, `users.onboarded_at`); until then `requireViewer` sends them there (`requireLogin` is for the welcome's own page/actions).
- Posts and comments are markdown (off 2026-10-17, back 2026-10-19 at the user's request): render them with `Markdown` (`components/markdown.tsx`, renderer `lib/markdown.ts`: html off, images off, `breaks: true`), the only place HTML is injected. Bios stay plain text (`PlainText`). Previews (`lib/preview.ts`) keep whole markdown blocks, 500 chars / 10 lines.
- Comment likes (`comment_likes`, `comments.like_count`). The post author's like on someone else's comment sets `comments.author_liked_at` (the "liked by the author" mark, the Q&A-style "this answered it"): it sorts first among top-level comments, then likes, then oldest; replies stay chronological. Post cards show `answered`. Like counts link to "Liked by" lists (`/p/[id]/likes`, `/c/[id]/likes`, `likers()`).
- Search: `posts.search` is a generated tsvector (`z_search_vector`, Hebrew prefix stripping); query builder `lib/search.ts`; see `docs/search.md`. `pg_trgm` is available (2026-10-19): substring/fuzzy people search and a typo-tolerant post fallback; Hebrew needs a UTF-8 aware `LC_CTYPE`.
- Moderation (`docs/moderation.md`, added 2026-10-19): admins in `admins` (checked in the DB on every action, never from the cookie); moderation services require a reason and write `moderation_actions` in the same transaction. `removed_at` (posts, comments) marks a moderator removal next to `deleted_at`; `users.suspended_at` = locked out (`requireLogin` redirects to `/suspended`; `generateMetadata` uses `canSeeContent()`). First admin: `node admin.mjs grant <handle> "<reason>"` (`scripts/admin.mjs`, raw SQL: keep it in step with `grantAdmin`/`revokeAdmin`). The seed makes `dana` an admin.
- Reports (`docs/reports.md`): "Report" in others' `⋯` menus (`reportContent`; reasons in `lib/reports.ts`, shared with the schema); the item's first open report notifies every admin; `/admin` starts with the queue (remove closes the reports, or `dismissReports`). Admin links show the open count.
- Usage dashboard (`docs/stats.md`): `/admin/stats`, read-only queries in `lib/stats.ts`; `daily_visits` (one row per user per day, written by `requireViewer`) is the only data kept for it. Days in `STATS_TIMEZONE`.
- Security headers: CSP in `proxy.ts` (no nonces: partial prerendering), the rest in `next.config.ts`. Sessions default to 4 h.
- Notifications (`docs/notifications.md`): written with their action in the service layer (`notify`/`unnotify`/`notifyMentions`), never for your own actions; undo soft-deletes them; deleted posts/comments hide theirs. A new user-visible action that someone else should hear about needs a type in `NOTIFICATION_TYPES` (`db/schema.ts`), its wording in `lib/notification-text.ts`, and a test. `@handle` mentions: `lib/mentions.ts`, rendered as links by `lib/markdown.ts`, autocomplete in the composer. Desktop alerts only while a Z tab is open (no web push: air-gapped).
- Theme: light / dark / system (in the header account menu, or a standalone button on welcome/suspended; `lib/theme.ts`, per browser in localStorage). An inline script in the root layout sets `<html data-theme>` before paint; Tailwind's `dark:` variant and the dark tokens key off `data-theme` (CSS falls back to `prefers-color-scheme` without JS).
- Composer: a ProseMirror WYSIWYG editor (`components/composer.tsx`) over `lib/editor-markdown.ts`, which reads and writes the same markdown `lib/markdown.ts` renders (its own markdown-it: no linkify or mentions, so URLs and `@handles` stay text until render). Bodies are still stored as markdown. `tests/editor-markdown.test.ts` checks that opening and saving a body renders the same.
- Colours: use the contrast-checked tokens `text-muted` / `text-link` / `text-danger` / `text-like` (app/globals.css), not raw `neutral-500` / `sky-*` / `red-*` for text.
- Delivery: `Dockerfile`, `scripts/build-images.sh`, `scripts/migrate.mjs` (advisory-locked; hook Job or init container; locally `MIGRATIONS_DIR=drizzle`), `scripts/admin.mjs`, `deploy/values.yaml` (example for the libchart), `docs/deploy.md`, `docs/keycloak.md`, `docs/security-notes.md`. Health probes: `/api/health?live`, `/api/health`.
- Experience (`docs/experience.md`): `experiences` rows (role, organization, location, month range), the owner edits them on the profile (`ExperienceEditor`); `saveExperience` / `deleteExperience` only touch the actor's own rows.
- Service details (`docs/service-info.md`, `lib/service-info.ts`): optional `rank`, `service_type`, `service_start` / `service_end` (days computed, not stored), `birth_date` (shown as the age only), `civic_phone`, `civic_email` on `users`; edited in "edit profile" only (`ServiceFields`), shown by `ServiceDetails`; checked in `updateProfile`. Rank and service type DB checks are built from the lists.
- Profession badges: `users.profession` (one of `PROFESSIONS` in `lib/professions.ts`, or null; `users_profession_ck` is built from it, so a new one needs `npm run db:generate`). Picked in the profile form, shown by `ProfessionBadge` on the profile and the hover card.
- Saved / liked / replies (`docs/bookmarks.md`): `bookmarks` (post or comment, private), `/saved` tabs, profile `?tab=replies`; mixed lists via `mixedPage` + `ItemList`/`CommentCard`.
- Code highlighting: `lib/highlight.ts` (highlight.js core, registered languages only, bundled); the composer's code blocks have a language picker (saved in the fence); without one, a guess only when sure.
- Profession badges link to `/search?profession=<p>` (`peopleByProfession`), chips on the search page.
- Polls (`docs/polls.md`): `posts.poll_options`/`poll_ends_at` + `poll_votes` (one active vote per person); `createPost(..., poll)`, `votePoll`; `postCols.poll` is JSON with counts and the viewer's vote; UI `components/poll.tsx`.
- Topics (`docs/topics.md`): `#tags` in posts (`lib/tags.ts`) are filed in `post_tags` by `setPostTags` on create and edit; `/t/<tag>` (newest / most liked), `/topics`, topic follows boost For You. Only posts, not comments.
- Pinned post: `users.pinned_post_id` (one per profile; `pinPost`/`unpinPost`, own live posts only), shown first on the profile with a label; reads ignore a deleted one.
- Paragraph direction (`lib/direction.ts`): the first word decides (mentions, tags, links, code skipped); a leading RLM/LRM, set by the composer's direction button, overrides it. Same rule in the composer (decorations) and the renderer (`dir` on each block).
- Layout (`app/layout.tsx`): wide screens get a start-side navigation rail (`components/nav-rail.tsx`, icons from `lg`, labels from `xl`; it replaces the header's search/bell/account there) and an end-side sidebar from `xl` (`components/side-bar.tsx`: search, popular topics, `whoToFollow`). Phones: the feed column and its header only. Constants shared by server and client components live in plain modules (`rail-styles.ts`, `lib/feed.ts`): exported from a "use client" file they reach server code as a client reference, not a value.
- Feeds: home tabs For You / Following (Following includes your own posts); newest-first for profiles, search and topics; most liked as a topic page sort. Ranking constants in `lib/feed.ts`, queries in `feedPage()`, notes and query plans in `docs/ranking.md`. Index on `ORDER BY x DESC` needs `.desc().nullsFirst()` in drizzle.

## Commands

| Command                                                                                  | What                                                                                      |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `docker compose up -d db keycloak`                                                       | Dev Postgres on :5433, Keycloak on :8180 (realm `z`)                                      |
| (or) any local Postgres 16                                                               | Set `DATABASE_URL`/`TEST_DATABASE_URL` in `.env`; needs role `z` owning DBs `z`, `z_test` |
| `npm run dev`                                                                            | Next dev server on :3000                                                                  |
| `npm test`                                                                               | Vitest against compose Postgres (`z_test` DB)                                             |
| `npm run lint` / `npm run typecheck`                                                     | ESLint + Prettier check / `tsc`                                                           |
| `npm run ci`                                                                             | lint + typecheck + test                                                                   |
| `npm run db:generate` / `db:migrate`                                                     | drizzle-kit                                                                               |
| `npm run seed` / `seed:large`                                                            | Reset dev DB with fictional data (60 / 10k posts)                                         |
| `npm run build:images`                                                                   | Build the amd64 image + OCI archive in `dist/` (docs/deploy.md)                           |
| `node --env-file=.env scripts/admin.mjs list` / `grant <handle> "<reason>"` / `revoke …` | Manage admins (docs/moderation.md)                                                        |

## Working agreements

- Per milestone: post a short plan (files, risks), implement after approval.
- Small commits per sub-step, no unrelated refactors.
- Ambiguous or conflicting requirement → stop and ask.

## Milestones

- [x] M0 Skeleton
- [x] M1 Data + seed
- [x] M2 Login, posting, edit/delete, likes, threaded comments, follows
- [x] M3 Feeds + infinite scroll + read more
- [x] M4 Search + chat deep link + polish
- [x] M5 Offline delivery
