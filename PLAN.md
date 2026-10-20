# Z — Implementation Plan (v0.3, for Claude Code)

## Changes from v0.2

- **Feed cursor**: For You now freezes the candidate set at `feed_as_of`. The cursor uses the pre-penalty score, the author penalty only re-ranks inside a page, and the client dedupes by id. The cursor test now also changes likes between pages.
- **Soft delete everywhere**: `like` and `follow` now have UUIDv7 ids and `deleted_at`. Uniqueness uses partial indexes. Un-like and unfollow soft-delete.
- **Edit and delete** of your own posts and comments added to phase 1 (M2). Added `edited_at`, so `updated_at` (which counter updates also change) is not shown as "edited".
- **Search**: core `simple` config with Hebrew prefix handling; `pg_trgm` is optional, pending Q4.
- **Auth library decided**: `openid-client` plus an encrypted cookie session via `jose`.
- **Markdown renderer decided**: `markdown-it` with raw HTML and images disabled. The preview is cut on block boundaries and computed when the post is saved.
- **Scroll restoration** via `sessionStorage`. **`seed:large`** for performance checks. **Handle resync** rules. **For You candidate window**. **Next.js 16**, with a shared Server Actions encryption key.
- **Moderation**: still out of scope; recorded as deferred in §12.
- **Delta-export readiness**: `updated_at` is guaranteed on every write (DB trigger as backstop) and indexed on every table, so a future "changes since X" export is a simple query.

## 1. What Z is

An internal professional social network (X/Twitter-inspired) for developers, infra, data people, tech leads and commanders across IDF units. Goals: cross-unit knowledge sharing and reuse, public professional recognition, and transparency between leadership and the field.

Z is the public town square. There are **no DMs**: 1-on-1 conversation hands off to the operational chat via a deep link.

## 2. Decisions already made

| Decision           | Choice                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Product shape      | **Feed-centered**. Pure feed in phase 1; forum-style pages may come later                                             |
| Stack              | Next.js 16 (App Router) + TypeScript, one codebase for UI and API                                                     |
| Database           | **Postgres everywhere** (local dev, CI, pilot). No SQLite                                                             |
| ORM                | **Drizzle** (pure TS, no native binaries, simplest for offline image builds)                                          |
| UI language        | Hebrew, RTL by default; all strings in one i18n file                                                                  |
| Pilot              | **Air-gapped network only**, delivered as container images built outside and transferred in                           |
| Phase 1 vocabulary | Posts, **likes**, **threaded comments**, follows. No post types, no tags, no visibility scope, no leader/role concept |
| Identity           | **Keycloak (OIDC)**, already available in the air-gapped network                                                      |
| OIDC library       | **`openid-client`** + encrypted cookie session via **`jose`** (no Auth.js)                                            |
| Markdown           | **`markdown-it`**, `html: false`, image rule disabled                                                                 |
| Deletion           | **Soft delete for every entity**, including likes and follows                                                         |
| Platform           | **OpenShift** (restricted SCC, arbitrary non-root UID), images delivered offline                                      |

## 3. Non-negotiable constraints

- **Air-gapped friendly**: no CDN assets, no Google Fonts (self-host with `next/font/local`), no analytics, `NEXT_TELEMETRY_DISABLED=1`, no runtime calls to external hosts, no Vercel-specific services.
- **Offline build and delivery** (see §9): the app ships as OCI images; the target network never runs `npm install`.
- **Minimal dependency footprint**: every added package needs a one-line justification in the PR. Commit the lockfile.
- **Auth = Keycloak via OIDC** (authorization code flow with PKCE, confidential client), implemented with `openid-client`:
  - Define an `AuthProvider` interface with two implementations: `KeycloakProvider` (real) and a dev-only user switcher for local development and tests. The switcher must be disabled when `NODE_ENV=production`.
  - Sessions live in an encrypted, `HttpOnly`, `Secure`, `SameSite=Lax` cookie built with `jose` (already a dependency of `openid-client`). The cookie holds only the Z user id, the expiry, and the ID token if it is needed for RP-initiated logout. Secret: `SESSION_SECRET`. Lifetime is configurable.
  - Logout clears the cookie and redirects to Keycloak's end-session endpoint.
  - Users are keyed on `keycloak_sub` and provisioned on first login from token claims (`sub` → `keycloak_sub`, `preferred_username` → handle, `name` → display name). Handle resync rules are in §5. No passwords are ever stored by Z.
- **Future sync readiness (cheap only)**:
  - Every table, including likes and follows, has a UUIDv7 `id`, `created_at`, `updated_at` and `deleted_at`.
  - All deletes are soft and go through the service layer. All reads filter `deleted_at IS NULL` unless they explicitly need deleted rows (e.g. comment placeholders).
  - `updated_at` must change on every write, including soft deletes and counter updates. The service layer sets it, and a shared `BEFORE UPDATE` trigger (`set_updated_at()`, defined once in a migration and attached to every table) sets `NEW.updated_at = now()` as a backstop for writes that bypass the service layer.
  - Every table has an index on `updated_at`. The intent is that a later delta export can be `WHERE updated_at > :watermark` with an overlap window and idempotent upserts by `id`.
  - Nothing else for multi-network sync is built now: no export job, no change-log table, no purge of soft-deleted rows.
- **Security review is required** before real deployment. Do not claim production readiness.

## 4. Tech choices

- **Framework**: Next.js 16 App Router, React Server Components, Server Actions for mutations, `output: 'standalone'`. The runtime Node version must satisfy Next 16's minimum; check this against the approved base image (Q3).
- **Server Actions key**: all replicas and successive deployments must share one Server Actions encryption key (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`). In M5, confirm from the Next.js docs whether it is read at build time or at runtime. Never bake a secret into the image; if it must be present at build time, document how it is supplied by the build environment.
- **Database**: Postgres 16, Drizzle ORM + drizzle-kit. Migrations are checked in and applied by a one-shot migrate job.
- **Styling**: Tailwind CSS (build-time only) with logical properties (`ms-`, `ps-`, `text-start`) for correct RTL.
- **Validation, tests and tooling**: Zod. Vitest (unit/integration against a real Postgres), Playwright (a few e2e tests). ESLint + Prettier. npm.
- **Markdown**: a single shared renderer module built on `markdown-it`, used both on the server and in the composer's live preview.
  - `html: false` (no raw HTML).
  - `linkify: true`.
  - The default `validateLink`, which blocks `javascript:`, `vbscript:`, `file:` and `data:` URLs.
  - The `image` rule disabled: phase 1 has no media uploads, and remote images would cause requests to arbitrary hosts.
  - Links get `rel="noopener noreferrer"`.

## 5. Data model (phase 1)

Every table has: `id` (UUIDv7), `created_at`, `updated_at`, `deleted_at` (nullable). Deleting means setting `deleted_at`.

- **`user`**: handle (unique among non-deleted users), display_name, unit, role_title, bio, avatar_seed, keycloak_sub (unique, from the OIDC `sub` claim).
  - All users are equal: no roles, badges or special status in the product.
  - **Identity is `keycloak_sub`; the handle is a display alias.** On each login, display_name and handle are resynced from claims. If the new handle collides with another active user, keep the current handle and log a warning.
  - Profile URLs `/u/[handle]` can change when a handle changes. This is acceptable for the pilot; document it.
- **`post`**: author_id, body (markdown, **max 20,000 chars**), preview (markdown, see §6.3), has_more (bool), like_count, comment_count, edited_at (nullable).
  - The counters are denormalized and updated in the same transaction as the change that affects them.
  - `preview` and `has_more` are recomputed on every create and edit.
  - `edited_at` is set only by user edits; the UI shows "edited" based on it, never on `updated_at`.
- **`comment`**: post_id, author_id, parent_comment_id (nullable; null = top-level), body (markdown, max 5,000 chars), edited_at (nullable).
  - Threaded as an adjacency list; a post's thread is loaded with a recursive CTE. Index on (post_id, parent_comment_id, created_at).
  - A deleted comment that has non-deleted replies renders as a "[deleted]" placeholder (no author, no body) so the thread stays intact. A deleted comment with no replies is hidden.
  - `post.comment_count` counts non-deleted comments at any depth. Deleting a comment decrements it by one; replies keep counting.
- **`like`**: user_id, post_id. Partial unique index on (user_id, post_id) `WHERE deleted_at IS NULL`.
  - Un-like soft-deletes the active row and decrements `like_count`.
  - Re-like inserts a new row and increments it.
  - Likes on a deleted post are rejected.
- **`follow`**: follower_id, followee_id. Partial unique index on (follower_id, followee_id) `WHERE deleted_at IS NULL`; check constraint `follower_id <> followee_id`.
  - Unfollow soft-deletes; re-follow inserts a new row.
- **Deleted posts**: excluded from all feeds and search. `/p/[id]` shows a "this post was deleted" page. New comments, replies and likes on a deleted post are rejected.
- **Indexes (minimum)**:
  - post (created_at DESC, id) `WHERE deleted_at IS NULL`
  - post (author_id, created_at DESC) `WHERE deleted_at IS NULL`
  - follow (follower_id) `WHERE deleted_at IS NULL`
  - like (post_id) `WHERE deleted_at IS NULL`
  - `updated_at` on every table

**Thread display rules**:

- Unlimited depth is stored. The UI indents up to depth 5; beyond that it shows "continue thread", linking to that comment's own page.
- Siblings are sorted oldest-first.
- Replies are collapsible, and large threads load children lazily ("show N more replies").

## 6. Feed

Views: **For You** (default), **Following**, **Latest**, **Profile** (`/u/[handle]`), **Post with comments** (`/p/[id]`).

### 6.1 Infinite scroll

- **Mechanics**: a client component using `IntersectionObserver` on a sentinel fetches the next page from a cursor-paginated route handler, 20 posts per page. The list is append-only; windowing is not needed in phase 1.
- **Without JS**: must also work as a plain "load more" link (cursor in the query string, server-rendered) when JS is slow or unavailable.
- **Position restoration**: when navigating back from a post, restore the list and scroll position from `sessionStorage`.
  - Persist the view name, `feed_as_of`, the current cursor, the loaded items and the scroll offset, keyed by view.
  - On back-navigation, rehydrate if the stored snapshot is younger than a configurable age (default 30 minutes); otherwise start a fresh snapshot.
- **Following and Latest**: plain keyset pagination on (created_at DESC, id).
- **Cursor stability for For You**: scores drift with time, so a naive score cursor duplicates or skips posts.
  - The first page response returns a `feed_as_of` timestamp. Every later page uses that same timestamp both for the age term and as a candidate filter (`created_at <= feed_as_of`), so posts created mid-scroll never enter the snapshot.
  - The cursor is `(cursor_score, id)`, where `cursor_score = base * boost` (no author penalty; see §6.2).
  - Like and comment counts are live, so a post's score can still move between page requests. The client therefore **dedupes by post id** when appending pages. Rare gaps caused by engagement changes mid-scroll are accepted.
  - Pull-to-refresh or reload starts a new snapshot.
- **Required tests** (fixed clock):
  - (a) With no writes between page requests, paging through the whole snapshot yields every candidate exactly once.
  - (b) With likes and comments added to random posts between page requests, the client-merged list has no duplicates.
  - (c) Posts created after `feed_as_of` never appear in that snapshot.

### 6.2 For You ranking (starting point, expected to be tuned)

```
base         = (1 + likes + 0.5 * comments) / (age_hours + 2) ^ 1.5
boost        = 2.0 if viewer follows the author, else 1.0
cursor_score = base * boost                       -- used for ordering in SQL and for the cursor
penalty      = 0.7 ^ (n-1) for the nth post by the same author within the page
display      = page re-sorted by cursor_score * penalty
```

- **Where each step runs**: the SQL query orders by `cursor_score` and returns the page. The author penalty is applied afterwards in the service layer, and only re-orders posts **within that page**. It never removes posts and never affects the cursor, so pagination stays stable.
- **Candidate window**: For You considers only posts from the last `FEED_WINDOW_DAYS` (default 30, in the ranking config). Following and Latest have no window.
- **Provenance**: the shape follows the well-known time-decay "gravity" ranking used by link aggregators. The specific constants are untested guesses, not derived from data. Keep them, together with the window, in one config object, document them in `docs/ranking.md`, and plan to calibrate with pilot usage.
- There are no special user classes, so nothing in ranking depends on who the author is beyond whether the viewer follows them.

### 6.3 Long posts

- **Preview rule**: in any feed list, show a **preview** with a **"read more"** button. The preview is computed on save by walking `markdown-it`'s block tokens and keeping whole blocks until about 500 characters of text. If the first block alone exceeds the limit:
  - a paragraph is cut at a word boundary;
  - a code block is cut at a line boundary and its fence is properly closed.

  The preview must always be valid markdown that renders without broken structure.

- **API**: returns `preview` and `has_more`. The full body is returned only on demand (expanded inline via server action or fetch, and also linked to `/p/[id]`). The feed payload must not include full bodies of long posts.
- **Post page**: the full post page shows the entire body.

## 7. Phase 1 feature list (MVP)

1. Login with Keycloak (OIDC); logout (including Keycloak end-session); dev user switcher for local/test only.
2. Posts: create (markdown, up to 20k chars) with live preview, **edit and delete your own posts**.
3. Comments: create comments and replies to comments (threaded); **edit and delete your own comments**. Edited content shows an "edited" marker.
4. Like / un-like with optimistic UI and correct counters.
5. Follow / unfollow users.
6. Feeds per §6 with infinite scroll, read-more and scroll restoration.
7. Search: Postgres full-text over non-deleted posts.
   - Uses the built-in `simple` configuration. Because Hebrew attaches prefixes to words (ו, ה, ב, ל, מ, ש, כ), the query builder also matches each Hebrew term with its leading prefix letters stripped (and vice versa) via prefix-aware OR terms. Document the limits in `docs/search.md`.
   - If Q4 confirms `pg_trgm` is available, add a trigram index for fuzzy substring matching as a separate, clearly marked migration. Until then, build nothing that depends on it.
8. "Message privately" button on profiles: opens a configurable deep link (`CHAT_DEEPLINK_TEMPLATE`, e.g. `chat://user/{handle}`); no DM storage.
9. Seed scripts:
   - `npm run seed`: about 12 fictional Hebrew users, about 60 posts including several long ones, plus comments, likes and follows.
   - `npm run seed:large`: about 10,000 posts across about 200 fictional users, with some threads more than 20 levels deep and some with 500+ comments, and realistic like and follow distributions. Used for query-plan and performance checks, not run in CI by default.

**Out of scope for phase 1**: tags/topics, post types (ideas, RFC, registry), prediction market, notifications, media uploads, real SSO, multi-network sync (including any delta export job), visibility scopes, moderation and admin tooling (deferred; see §12).

## 8. Milestones (each ends with lint, typecheck and tests passing)

- **M0 Skeleton**
  - Scope: repo; Next.js 16 + TS + Tailwind RTL; Drizzle + Postgres via `docker compose` for dev; CI script; README with air-gap notes; `CLAUDE.md`.
  - _Done when_ `docker compose up -d db keycloak && npm run dev` (compose includes a dev Keycloak with an imported realm and test users) shows an RTL Hebrew shell, and `npm test` runs against Postgres.
- **M1 Data + seed**
  - Scope: schema with soft delete everywhere, partial unique indexes and `updated_at` indexes; the shared `set_updated_at()` trigger attached to every table; migrations; service layer; markdown module with preview computation; `seed` and `seed:large`.
  - _Done when_ `npm run seed` populates the DB and service-layer tests pass, including: un-like/re-like and unfollow/re-follow, counter correctness, and preview truncation on adversarial markdown (long first paragraph, long code fence, nested lists).
  - A test also confirms the trigger: for every table, a raw SQL `UPDATE` that does not set `updated_at` (including one that sets `deleted_at`) still advances it.
- **M2 Login, posting, editing and deleting, likes, threaded comments, follows**
  - Scope: Keycloak OIDC login with `openid-client`, cookie sessions, Server Actions with Zod validation, edit/delete of your own posts and comments, recursive-CTE comment threads with depth cap and lazy loading.
  - _Done when_ Playwright covers: login → post → edit post → comment → reply to comment → delete the parent comment (placeholder shown) → like → un-like → like → follow → logout.
  - Service tests also cover: deleted-parent placeholders, counters after deletes, rejecting writes on deleted posts, authorization (users cannot edit or delete other users' content), and handle resync including collisions.
- **M3 Feeds + infinite scroll + read more**
  - Scope: ranking function with unit tests, snapshot cursor, page-local author penalty, client dedupe, observer-based scrolling, no-JS load-more, scroll restoration.
  - _Done when_ all three §6.1 tests pass, the seeded For You order looks sensible, and the feed and thread queries have been checked with `EXPLAIN ANALYZE` on `seed:large` (results noted in `docs/ranking.md`).
- **M4 Search + chat deep link + polish**
  - Scope: search per §7.7 (scope depends on Q4), private-message button, empty/error states, accessibility pass (keyboard, contrast, RTL mirroring).
- **M5 Offline delivery**
  - Scope: production image, example Helm `values.yaml`, offline transfer instructions, `docs/security-notes.md` (threats, what is not done, including the absence of moderation), and a dry run per §9.

## 9. Offline build and delivery to OpenShift via Helm (pilot is air-gapped only)

- **Image**: multi-stage Dockerfile (deps → build → minimal runtime from Next.js standalone output), with no dev dependencies or build tools in the final image. One image, `z-app`, which also exposes a `migrate` command (`node migrate.js` or equivalent) so migrations need no extra tooling.
- **Migration step** (depends on what the libchart supports; see Q1): preferred is a Helm pre-install/pre-upgrade hook Job running `migrate`. The fallback is an init container running `migrate`, guarded by a Postgres advisory lock so concurrent replicas cannot race. Migrations are forward-only and must be backward-compatible with the previous app version so rollbacks are safe.
- **OpenShift constraints** (restricted SCC):
  - Must run as an arbitrary non-root UID, so do not rely on a fixed UID.
  - Make runtime directories group-0 owned and group-writable (`chgrp -R 0 <dir> && chmod -R g=u <dir>`).
  - Listen on 8080.
  - Support a read-only root filesystem, with writable `/tmp` and Next cache directories provided via `emptyDir`.
- **Build and transfer**:
  - Build on a connected machine (podman or docker). Pin base images by digest, using the organization's approved base (e.g. a UBI Node image) if one exists; see Q3.
  - Export with `skopeo copy` to an OCI archive, and ship a manifest of tags, digests and SHA-256 checksums plus an SBOM (e.g. `syft`).
  - In the air-gapped network, verify checksums and push to the internal registry with `skopeo copy oci-archive:… docker://<internal-registry>/z/z-app:<tag>`.
- **Deployment via your existing Helm library chart**: Z does not ship its own templates. The repo delivers only a `deploy/values.yaml` (plus `values-<env>.yaml` overrides) in the shape your libchart expects, so all chart-specific behavior stays in your fixed templates. Claude Code will not have access to the libchart from outside the network, so M5 produces a documented, commented _example_ values file covering:
  - image repository/tag, replicas, resources, port 8080;
  - probes on `/api/health`;
  - env vars and secret references: `DATABASE_URL`, OIDC issuer/client ID/secret, `SESSION_SECRET`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (if read at runtime), public base URL, `CHAT_DEEPLINK_TEMPLATE`, `FEED_WINDOW_DAYS`;
  - Route host/TLS;
  - the migration step.

  You adapt key names to the libchart inside the network.

- **Postgres**: managed Postgres is provided by the platform. The app only needs a `DATABASE_URL` (injected from a Secret), with TLS options configurable via env; Z deploys no database in the cluster.
  - Required: Postgres 16, core features only. Triggers are plain PL/pgSQL, which is built in.
  - Optional: `pg_trgm`, pending Q4. Its migration must not be applied unless the extension is confirmed.
  - Ask the DBA for a dedicated database and role with schema-owner rights for migrations (or a separate migration role).
- **Keycloak client setup** (documented in `docs/keycloak.md`):
  - Confidential client, authorization code + PKCE.
  - Exact redirect URIs and post-logout redirect URIs for the Route hostname.
  - Scopes `openid profile`.
  - Which claims map to handle and display name.
  - Behind the OpenShift router, set the public base URL via env and honor `X-Forwarded-*` headers.
- **Dependencies offline**: the target network never runs `npm install`. If building inside the air gap is ever needed, `npm ci` must work from an internal mirror or a vendored offline cache; document both.

## 10. Later phases (not to be built yet)

Topics/tags and interest-based personalization, typed pages (ideas backlog, RFC round table, State-of-the-Art registry), prediction market, real SSO, notifications, moderation, and multi-network sync with visibility scopes (delta export by `updated_at` watermark, with receivers recomputing counters rather than syncing them).

## 11. Working agreements for Claude Code

- Plan first: for each milestone, post a short plan (files to touch, risks) before coding; implement after approval.
- Small commits per sub-step; no unrelated refactors.
- Never add calls to external hosts. Never commit secrets or real personal data; all seed data is fictional.
- Never hard-delete rows or add a purge job; soft-deleted rows are tombstones a future sync depends on.
- Keep `CLAUDE.md` in the repo root with:
  - the §3 constraints;
  - the commands `dev`, `test`, `seed`, `seed:large`, `lint`, `typecheck`, `build:images`;
  - the milestone checklist.
- If a requirement is ambiguous or conflicts with another, stop and ask.

## 12. Decided, deferred, and open questions

**Decided**: Keycloak for identity (a client can be obtained), OpenShift with the existing Helm libchart (values-only deployment), platform-managed Postgres, threaded comments, no leader concept, soft delete everywhere with a guaranteed, indexed `updated_at`, `openid-client` for OIDC, `markdown-it` for markdown. Hosting, registry and security-review ownership are handled outside this plan.

**Deferred (revisit before broad rollout)**: moderation. Phase 1 has no way for anyone other than the author to remove a post. Before the pilot expands beyond a small trusted group, decide on at least a documented takedown path (e.g. a CLI that soft-deletes through the service layer) and an audit log of deletions.
_Done 2026-10-19 at the user's request_: admins (granted by CLI, then on `/admin`) remove/restore posts and comments, suspend users, clear bios and reset handles, all with a reason in an audit log (`docs/moderation.md`).

**Changed 2026-10-19 at the user's request (Q&A without a new post type)**: markdown is back for posts and comments, posts up to 20,000 characters, comments 10,000. Comments can be liked; the post author's like marks a comment ("liked by the author") and puts it first, so a question post with its best answer works like a Q&A thread. A Top feed tab (all-time most liked) keeps useful posts findable.

**Open (for Noam)**:

1. Does your libchart support a pre-install/pre-upgrade hook Job (for migrations), or should the plan use the init-container fallback?
2. Which Keycloak claims are available for handle, display name and unit/organization, and is `preferred_username` stable and unique? (Needed in M2; the plan falls back to `sub` + `name` if not.)
3. Run the needs survey from the concept doc before M3, so ranking and later features reflect real pain points.
4. Is the `pg_trgm` extension available (or installable by the DBA) on the managed Postgres? Needed before M4; without it, search ships with `simple` + prefix handling only.
   _Answered 2026-10-19: available._ Used for substring/fuzzy people search and a typo-tolerant post search fallback (migration 0009, `docs/search.md`). Hebrew needs a UTF-8 aware database `LC_CTYPE`: confirm with the DBA.
