# Deploying Z (air-gapped OpenShift)

**Security review is required before any real deployment**
(`docs/security-notes.md`). Nothing here makes Z production-ready on its own.

## 1. Build and package (connected machine)

Needs docker (or podman: `ENGINE=podman`) and `skopeo`; `syft` optional (SBOM).

```sh
npm run build:images              # TAG defaults to the git short SHA (+ -dirty)
TAG=1.0.0 npm run build:images    # explicit tag
NODE_IMAGE=<approved-base>@sha256:... npm run build:images   # organization base
```

Output in `dist/`:

| File                         | What                                               |
| ---------------------------- | -------------------------------------------------- |
| `z-app-<tag>.oci.tar`        | the image, `linux/amd64`, as an OCI archive        |
| `z-app-<tag>.manifest.txt`   | tag, image digest, git commit, build time, SHA-256 |
| `z-app-<tag>.sha256`         | checksum file                                      |
| `z-app-<tag>.sbom.spdx.json` | SBOM (only if `syft` is installed)                 |

The image: Next.js standalone server on 8080 (`node server.js`) plus `node migrate.mjs` and
`node admin.mjs` (`docs/moderation.md`). No npm,
no dev dependencies, no build tools. Runs as any UID in group 0; root filesystem can be read-only
(writable `emptyDir` at `/tmp` and `/app/.next/cache`). The base image is pinned by digest in
the `Dockerfile`.

## 2. Transfer and push (inside the network)

```sh
shasum -a 256 -c z-app-<tag>.sha256
skopeo inspect oci-archive:z-app-<tag>.oci.tar | grep Digest   # matches the manifest
skopeo copy oci-archive:z-app-<tag>.oci.tar docker://<internal-registry>/z/z-app:<tag>
```

## 3. One-time setup

**Postgres** (platform-managed, Postgres 16, core features only): ask the DBA for a dedicated
database and a role that owns its `public` schema (migrations create tables, functions,
triggers and indexes), or a separate migration role plus a runtime role with DML only.
One extension: `pg_trgm` (available). Migration 0009 runs `CREATE EXTENSION IF NOT
EXISTS pg_trgm`; it is a trusted extension, so the database owner may create it, or the DBA can
create it beforehand. Ask the DBA which `LC_CTYPE` the database has: it must be UTF-8 aware
(`C.UTF-8`, `he_IL.UTF-8`, `en_US.UTF-8`) for fuzzy search to see Hebrew (`docs/search.md`).
TLS: `?sslmode=verify-full` in `DATABASE_URL`; mount a private CA and set `DATABASE_CA_FILE` if
needed.

**Keycloak**: see `docs/keycloak.md`.

**Secrets** in the namespace: `DATABASE_URL`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET`
(`openssl rand -base64 48`). Never commit them.

## 4. Deploy with the libchart

`deploy/values.yaml` is a commented **example**: image, replicas, resources, port, probes,
env and secrets, Route/TLS, read-only filesystem volumes, and both migration options.

### Adapting the values

The key names are guesses. Map each block to your libchart's schema, and check the result
renders as intended before installing:

```sh
helm template z <libchart-or-wrapper> -f deploy/values.yaml -f deploy/values-<env>.yaml | less
```

### Migrations

Same command either way: `node migrate.mjs` with `DATABASE_URL` (and `DATABASE_CA_FILE`).

- **Hook Job (preferred)** if the libchart can render a Job with
  `helm.sh/hook: pre-install,pre-upgrade` (or has an `extraManifests`-style escape hatch).
  Argo CD runs these hooks as PreSync. A failed migration stops the release.
- **Init container (fallback)** otherwise. A Postgres advisory lock serializes replicas: the
  first applies, the rest wait and find nothing to do (verified with concurrent runs).

How to find out what the libchart supports: `grep -rn "helm.sh/hook\|kind: Job"` in its
templates, or ask how other services run their migrations.

Migrations are forward-only. Each release's schema must still work with the previous release's
code, so a rollback is just deploying the previous image (no down-migrations).

### Behind the router

`APP_URL` must be the public `https://` URL; it builds the OIDC redirect URI. Session cookies are
`Secure`, so the Route must terminate TLS (edge is fine).

### Server Actions key and rolling updates

Next.js embeds a Server Actions encryption key in each build. All replicas run the same image,
so they share it; `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not needed. During a rolling update a
browser tab opened on the old version may get one failed action and must reload.

## 5. Smoke test after deploy

- `/api/health?live` and `/api/health` return `{"ok":true}`.
- Opening the Route redirects to Keycloak; logging in lands on the feed.
- Post, like, comment, follow; search finds the post.
- After the first login, make the first admin: `oc exec deploy/z -- node admin.mjs grant
<handle> "<reason>"`; "ניהול" appears in their account menu (the round initial in the header) and `/admin` opens.
- Response headers include `content-security-policy` and `strict-transport-security`.

## Dry run (what was verified locally)

The same image, `linux/amd64` (emulated on an ARM Mac), run with `--read-only`, `tmpfs` at
`/tmp` and `/app/.next/cache`, a random UID in group 0, against a local Postgres 16 and the
compose Keycloak:

```sh
# migrations on an empty database (twice: the second run is a no-op)
docker run --rm -u 431987:0 --read-only -e DATABASE_URL=postgres://z:z@host.docker.internal:5432/z_dryrun z-app:<tag> node migrate.mjs

# the app on :3000 (the dev Keycloak is http, hence OIDC_ALLOW_HTTP=1: local dry runs ONLY)
docker run -d --name z-dryrun -p 3000:8080 -u 431987:0 --read-only \
  --tmpfs /tmp --tmpfs /app/.next/cache --env-file <.env without DATABASE_URL> \
  -e DATABASE_URL=postgres://z:z@host.docker.internal:5432/z \
  -e OIDC_ISSUER=http://host.docker.internal:8180/realms/z -e OIDC_ALLOW_HTTP=1 z-app:<tag>

# the whole e2e suite against it (the browser maps host.docker.internal to 127.0.0.1)
E2E_DOCKER_HOST=1 npx playwright test
```

Result: migrations applied and idempotent; all e2e tests pass against the container.

## Building inside the air gap (only if ever needed)

The target network never runs `npm install` from the internet. Two options:

- **Internal npm mirror** (e.g. Nexus/Artifactory proxy): `npm config set registry <mirror>`,
  then `npm ci` as usual.
- **Vendored cache**: on a connected machine, `npm ci --cache ./npm-cache` populates the cache
  from the lockfile; ship `npm-cache/` with the source; inside, run
  `npm ci --offline --cache ./npm-cache`. The `Dockerfile` would then `COPY npm-cache` and use
  the same flags.

Pin the base image by digest from the internal registry in either case.
