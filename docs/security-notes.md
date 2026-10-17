# Security notes

**Status: not reviewed. Z is a pilot and is not production-ready.** A security review by the
responsible team is required before any real deployment (PLAN.md §3). This page lists what
the code does, what it does not do, and where to look, so the review starts from facts.

## Context

Internal, air-gapped network; every user is authenticated by the organization's Keycloak; all
content is visible to every logged-in user (no private content, no DMs). Main assets: the
integrity of posts and identities, the availability of the service, and the session secret.

## What is in place

| Area           | What the code does                                                                                                                                              | Where                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Authentication | OIDC authorization code + PKCE + state + nonce, confidential client; issuer must be https in production                                                         | `lib/auth/keycloak.ts`                   |
| Dev login      | `/dev/login` user switcher returns 404 and `AUTH_PROVIDER=dev` throws when `NODE_ENV=production`                                                                | `lib/auth/provider.ts`, `app/dev/login`  |
| Sessions       | Encrypted cookie (jose, `dir` + A256GCM, key = SHA-256 of `SESSION_SECRET`), HttpOnly, Secure, SameSite=Lax, 12 h default; only the user id and ID token inside | `lib/auth/session.ts`                    |
| Access         | Every page, route handler and Server Action resolves the session to a live user (`requireViewer`); the proxy only does the cheap pre-check                      | `lib/auth/viewer.ts`, `proxy.ts`         |
| Authorization  | Edit/delete only by the author, checked in the service layer; writes to deleted posts rejected                                                                  | `lib/services.ts`                        |
| Input          | zod at every boundary; length caps (post 500, comment 5,000, bio 70)                                                                                            | `lib/services.ts`, `lib/limits.ts`       |
| SQL injection  | Parameterized queries (drizzle / postgres-js) only; the search query builder passes only letters and digits into `to_tsquery`                                   | `lib/search.ts`                          |
| XSS            | All user text is rendered as React text (plain text, no markdown, no `dangerouslySetInnerHTML` anywhere)                                                        | `components/post-card.tsx` (`PlainText`) |
| CSRF           | SameSite=Lax session cookie; Next.js Server Actions check Origin against Host; logout is POST-only                                                              |                                          |
| Open redirect  | `next` after login is accepted only as a same-origin path                                                                                                       | `safeNext` in `lib/auth/provider.ts`     |
| Chat deep link | Template from config; `javascript:`/`data:`/`vbscript:` refused; handle URL-encoded                                                                             | `lib/chat.ts`                            |
| Data           | Soft delete only; nothing is purged (tombstones for future sync)                                                                                                | PLAN.md §3                               |
| Container      | No package managers or build tools in the image; non-root, arbitrary UID; read-only root FS supported; base pinned by digest                                    | `Dockerfile`                             |
| Supply chain   | Lockfile committed, `npm ci --ignore-scripts`; `npm audit --omit=dev`: 0 known vulnerabilities (2026-10-17); SBOM via syft                                      | `scripts/build-images.sh`                |
| Egress         | No calls to external hosts at runtime: only Postgres and Keycloak. No CDN, fonts are local, telemetry off                                                       |                                          |

## What is NOT done (decide before rollout)

- **Moderation** (PLAN.md §12, deferred): nobody but the author can remove a post. Before the
  pilot grows beyond a small trusted group, define at least a takedown path (e.g. a CLI that
  soft-deletes through the service layer) and an audit log of deletions.
- **Rate limiting**: none. One user can post, like or search as fast as they can send requests.
  Add it at the router/ingress or in the app before wide use.
- **Security headers**: no CSP, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`.
  Set them at the router or add them in `next.config.ts` (a CSP needs testing with Next's
  inline scripts).
- **Session revocation**: sessions are stateless cookies. Logging out of Keycloak elsewhere,
  or disabling a user in Keycloak, does not end an existing Z session until it expires
  (`SESSION_MAX_AGE_HOURS`). Rotating `SESSION_SECRET` logs everyone out.
- **Account lifecycle**: users are created on first login and never deactivated from Keycloak
  data. There is no admin UI.
- **Deleted content is still in the database** (soft delete, by design). Anyone with DB access
  can read it; "delete" is not erasure.
- **Audit logging**: no structured audit trail of logins or changes; only server logs (which
  include handles in a few warnings).
- **Image scanning**: the base (`node:22-slim`, Debian) must be scanned by the organization's
  scanner, or replaced with the approved base (PLAN.md Q3).
- **Backups / DR**: delegated to the platform Postgres.
- **Load**: For You scans the 30-day window per page (`docs/ranking.md`); fine at pilot scale,
  not load-tested.

## Configuration that must be right

- `SESSION_SECRET`: 32+ random bytes, from a Secret, unique per environment.
- `OIDC_ISSUER` https; `APP_URL` = the public https Route URL; redirect URIs exact
  (`docs/keycloak.md`).
- `OIDC_ALLOW_HTTP` must **never** be set outside a local dry run.
- `DATABASE_URL` with `sslmode=verify-full` (plus `DATABASE_CA_FILE` for a private CA).
- The Route must terminate TLS (cookies are `Secure`), and must pass the original `Host` header
  so Server Actions' origin check accepts requests.
