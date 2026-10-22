# Z

Internal professional social network for developers, infra, data people, tech leads and commanders. Hebrew, RTL.

> Not production-ready. A security review is required before any real deployment.

## Local development

Requires Node ≥ 20.9 (developed on 22) and Docker.

```sh
cp .env.example .env
npm ci
docker compose up -d db keycloak   # Postgres :5433, Keycloak :8180
npm run dev                        # http://localhost:3000
npm run ci                         # lint + typecheck + tests
```

Dev Keycloak: admin console at http://localhost:8180 (`admin`/`admin`). Realm `z` has the fictional users `dana`, `yossi` and `noa`, each with the username as the password. The realm, client secret and passwords are dev-only.

## Air-gap notes

- No runtime calls to external hosts: no CDN, no Google Fonts, no analytics. The Heebo font (OFL, `app/fonts/`) is committed and served by `next/font/local`.
- `NEXT_TELEMETRY_DISABLED=1` must be set in every environment (see `.env.example`).
- The app ships as OCI images built on a connected machine and transferred in. The target network never runs `npm install`.
- `output: "standalone"` keeps the runtime image free of dev dependencies.
