# Z

Internal professional social network (Hebrew, RTL). Full spec: `PLAN.md`.

@AGENTS.md

## Constraints (PLAN.md §3, non-negotiable)

- **Air-gapped**: no CDN assets, no Google Fonts (fonts are local via `next/font/local`), no analytics, `NEXT_TELEMETRY_DISABLED=1`, no runtime calls to external hosts, nothing Vercel-specific.
- **Offline delivery**: ships as OCI images; the target network never runs `npm install`.
- **Minimal deps**: every new package needs a one-line justification in the commit/PR. Lockfile is committed.
- **Auth**: Keycloak OIDC (code + PKCE, confidential client) via `openid-client`; encrypted `HttpOnly`/`Secure`/`SameSite=Lax` cookie session via `jose`. `AuthProvider` interface: `KeycloakProvider` + dev user switcher (disabled when `NODE_ENV=production`). Users keyed on `keycloak_sub`; no passwords stored.
- **Sync readiness**: every table has UUIDv7 `id`, `created_at`, `updated_at`, `deleted_at`, and an index on `updated_at`. All deletes are soft, through the service layer. Reads filter `deleted_at IS NULL`. `updated_at` changes on every write; the shared `set_updated_at()` trigger is the backstop. Never hard-delete, never add a purge job.
- **RTL**: use logical Tailwind utilities (`ms-`, `ps-`, `text-start`), never `ml-`/`pl-`/`text-left`. All strings go in `lib/i18n/he.ts`.
- **Security review is required** before real deployment. Never claim production readiness.
- Postgres everywhere (no SQLite). Never commit secrets or real personal data; seed data is fictional.

## Data conventions

- Tables are plural (`users`, `posts`, `comments`, `likes`, `follows`): `user`/`like` are reserved words.
- A new table needs: the `base` columns from `db/schema.ts`, an `updated_at` index, and a `CREATE TRIGGER ... set_updated_at()` in its migration. `tests/trigger.test.ts` lists every table; add it there.
- Writes go through `lib/services.ts` and throw `ServiceError` (`invalid` / `not_found` / `forbidden` / `gone`).
- Auth: `lib/auth/` (`AuthProvider`: Keycloak or dev switcher at `/dev/login`). Dev Keycloak users `dana`/`yossi`/`noa` (password = username) have fixed ids that the seed reuses as `keycloak_sub`. Claim mapping lives in `finishLogin` (`lib/auth/keycloak.ts`).
- Server Actions (`app/actions.ts`) only check the session and input shape, call a service, then `refresh()`. Anything that reads cookies or the DB sits under `<Suspense>` after `await connection()`; route handlers that call out at request time also `await connection()` so `next build` never contacts the DB or Keycloak.
- Don't run `next build` while `next dev` is running; it overwrites `.next` and dev serves stale CSS. Edits to `app/globals.css` sometimes don't hot-reload either: check the served CSS, and restart `next dev` if the rule is missing.
- Drizzle's postgres-js driver returns raw-SQL timestamps as strings; compare them in SQL.

## Commands

| Command                              | What                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| `docker compose up -d db keycloak`   | Dev Postgres on :5433, Keycloak on :8180 (realm `z`) |
| `npm run dev`                        | Next dev server on :3000                             |
| `npm test`                           | Vitest against compose Postgres (`z_test` DB)        |
| `npm run lint` / `npm run typecheck` | ESLint + Prettier check / `tsc`                      |
| `npm run ci`                         | lint + typecheck + test                              |
| `npm run db:generate` / `db:migrate` | drizzle-kit                                          |
| `npm run seed` / `seed:large`        | not yet (M1)                                         |
| `npm run build:images`               | not yet (M5)                                         |

## Working agreements (PLAN.md §11)

- Per milestone: post a short plan (files, risks), implement after approval.
- Small commits per sub-step, no unrelated refactors.
- Ambiguous or conflicting requirement → stop and ask.

## Milestones

- [x] M0 Skeleton
- [x] M1 Data + seed
- [x] M2 Login, posting, edit/delete, likes, threaded comments, follows
- [ ] M3 Feeds + infinite scroll + read more
- [ ] M4 Search + chat deep link + polish
- [ ] M5 Offline delivery
