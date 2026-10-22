# Security notes

**Status: not reviewed. Z is a pilot and is not production-ready.** A security review by the
responsible team is required before any real deployment. This page lists what
the code does, what it does not do, and where to look, so the review starts from facts.

## Context

Internal, air-gapped network; every user is authenticated by the organization's Keycloak; all
content is visible to every logged-in user (no private content, no DMs). Main assets: the
integrity of posts and identities, the availability of the service, and the session secret.

## What is in place

| Area           | What the code does                                                                                                                                                                | Where                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Authentication | OIDC authorization code + PKCE + state + nonce, confidential client; issuer must be https in production                                                                           | `lib/auth/keycloak.ts`                       |
| Dev login      | `/dev/login` user switcher returns 404 and `AUTH_PROVIDER=dev` throws when `NODE_ENV=production`                                                                                  | `lib/auth/provider.ts`, `app/dev/login`      |
| Sessions       | Encrypted cookie (jose, `dir` + A256GCM, key = SHA-256 of `SESSION_SECRET`), HttpOnly, Secure, SameSite=Lax, 4 h default; only the user id and ID token inside                    | `lib/auth/session.ts`                        |
| Access         | Every page, route handler and Server Action resolves the session to a live user (`requireViewer`); the proxy only does the cheap pre-check                                        | `lib/auth/viewer.ts`, `proxy.ts`             |
| Authorization  | Edit/delete only by the author, checked in the service layer; writes to deleted posts rejected                                                                                    | `lib/services.ts`                            |
| Moderation     | Admins (checked in the DB on every action, not from the cookie) remove/restore content, suspend users, clear bios, reset handles; reason required; audit log                      | `docs/moderation.md`                         |
| Rate limits    | Per user: posts, comments, likes, follows counted in Postgres (deleted rows included); search per server process                                                                  | `RATE` in `lib/limits.ts`                    |
| Headers        | CSP (self only, no framing, no objects; inline scripts allowed, see below), HSTS, nosniff, X-Frame-Options, Referrer-Policy, COOP/CORP, Permissions-Policy                        | `proxy.ts`, `next.config.ts`                 |
| Input          | zod at every boundary; length caps (post 20,000, comment 10,000, bio 70)                                                                                                          | `lib/services.ts`, `lib/limits.ts`           |
| SQL injection  | Parameterized queries (drizzle / postgres-js) only; the search query builder passes only letters and digits into `to_tsquery`                                                     | `lib/search.ts`                              |
| XSS            | Posts and comments: markdown-it with raw HTML off, images off, javascript:/data:/vbscript:/file: links refused; the only `dangerouslySetInnerHTML`. Everything else is React text | `lib/markdown.ts`, `components/markdown.tsx` |
| CSRF           | SameSite=Lax session cookie; Next.js Server Actions check Origin against Host; logout is POST-only                                                                                |                                              |
| Open redirect  | `next` after login is accepted only as a same-origin path                                                                                                                         | `safeNext` in `lib/auth/provider.ts`         |
| Chat deep link | Template from config; `javascript:`/`data:`/`vbscript:` refused; handle URL-encoded                                                                                               | `lib/chat.ts`                                |
| Data           | Soft delete only; nothing is purged (tombstones for future sync)                                                                                                                  | CLAUDE.md                                    |
| Container      | No package managers or build tools in the image; non-root, arbitrary UID; read-only root FS supported; base pinned by digest                                                      | `Dockerfile`                                 |
| Supply chain   | Lockfile committed, `npm ci --ignore-scripts`; `npm audit --omit=dev`: 0 known vulnerabilities (2026-10-19); SBOM via syft                                                        | `scripts/build-images.sh`                    |
| Egress         | No calls to external hosts at runtime: only Postgres and Keycloak. No CDN, fonts are local, telemetry off                                                                         |                                              |

## What is NOT done (decide before rollout)

- **CSP allows inline scripts**: partial prerendering serves static shells that can't carry a
  per-request nonce, so `script-src` includes `'unsafe-inline'`. It still blocks scripts, frames
  and objects from other origins and keeps forms on Z and Keycloak. A strict nonce CSP would
  mean turning partial prerendering off (every page rendered per request). The main XSS defense
  is the markdown renderer's configuration (`lib/markdown.ts`, tested with hostile input in
  `tests/markdown.test.ts`); the review should look at it closely.
- **Rate limits are coarse**: fixed per-user windows (`RATE`), no per-IP limit, no global limit.
  The search limit is per server process (N replicas allow N times as much) and resets on
  restart. The router/ingress can add per-IP limits in front.
- **Session revocation**: sessions are stateless cookies. A user disabled in Keycloak keeps using
  Z until their session ends (4 h by default, `SESSION_MAX_AGE_HOURS`). To cut someone off at
  once, suspend them (`docs/moderation.md`): that locks them out of Z on their next request. Rotating
  `SESSION_SECRET` logs everyone out.
- **Moderation**: users can report posts and comments (`docs/reports.md`); admins see who
  reported. Affected users are notified of removals and restores, with the reason but not the
  admin's name.
- **Service details** (`docs/service-info.md`): rank, service type, service start and end, birth date (shown as the age) and
  a civilian phone and email are optional, self-reported and visible to every logged-in user.
  Phone and email are personal contact data: decide whether that is acceptable, or limit who
  sees them. Nothing is verified (anyone can claim any rank).
- **Usage tracking**: Z records one row per user per day they open it (`daily_visits`), and
  admins see a top-contributors list by name (`docs/stats.md`). Tell pilot users.
- **Notifications reveal activity to the recipient** (who liked, followed, mentioned): all of it is
  already visible on the site. Desktop notifications show a snippet of the text on the user's
  screen while Z is open; they are opt-in per browser.
- **Account lifecycle**: users are created on first login and never deactivated from Keycloak
  data.
- **Deleted content is still in the database** (soft delete, by design). Anyone with DB access
  can read it; "delete" is not erasure.
- **Audit logging**: moderation actions are logged (`moderation_actions`). Logins, posts and
  edits are not, beyond server logs (which include handles in a few warnings).
- **Image scanning**: the base (`node:22-slim`, Debian) must be scanned by the organization's
  scanner, or replaced with the approved base.
- **Backups / DR**: delegated to the platform Postgres.
- **Load**: For You scans the 30-day window per page (`docs/ranking.md`); fine at pilot scale,
  not load-tested.

## Configuration that must be right

- `SESSION_SECRET`: 32+ random bytes, from a Secret, unique per environment.
- `OIDC_ISSUER` https; `APP_URL` = the public https Route URL; redirect URIs exact
  (`docs/keycloak.md`).
- `OIDC_ALLOW_HTTP` must **never** be set outside a local dry run.
- At least one admin, granted with `node admin.mjs grant` (`docs/moderation.md`), and a short
  list of who they are.
- `DATABASE_URL` with `sslmode=verify-full` (plus `DATABASE_CA_FILE` for a private CA).
- The Route must terminate TLS (cookies are `Secure`), and must pass the original `Host` header
  so Server Actions' origin check accepts requests.
