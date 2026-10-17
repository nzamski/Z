#!/usr/bin/env sh
# Requires the compose Postgres (docker compose up -d db).
set -e
npm run lint
npm run typecheck
npm test
