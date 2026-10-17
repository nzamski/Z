# syntax=docker/dockerfile:1
# Z production image (PLAN.md §9). One image: `node server.js` (default) and `node migrate.mjs`.
# Build on a connected machine: `npm run build:images` (docs/deploy.md).
#
# Base: pinned by digest. Replace with the organization's approved Node 22 base (PLAN.md Q3):
#   --build-arg NODE_IMAGE=<registry>/ubi9/nodejs-22@sha256:...
ARG NODE_IMAGE=node:22-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

FROM ${NODE_IMAGE} AS deps
WORKDIR /src
COPY package.json package-lock.json ./
# Exact lockfile versions; no install scripts run (nothing here needs them).
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The build never contacts the database or Keycloak (CLAUDE.md), so it needs no env.
RUN npm run build && mkdir -p public

FROM ${NODE_IMAGE} AS runtime
# No package managers in the final image: nothing at runtime installs anything.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public
# Migrations: SQL files + the runner and its two (dependency-free) packages, complete.
COPY --from=build /src/drizzle ./drizzle
COPY --from=build /src/scripts/migrate.mjs ./migrate.mjs
COPY --from=deps /src/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps /src/node_modules/postgres ./node_modules/postgres
# OpenShift restricted SCC: arbitrary UID in group 0. The root FS can be read-only; mount
# emptyDir at /tmp and /app/.next/cache (deploy/values.yaml).
RUN mkdir -p .next/cache && chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 8080
CMD ["node", "server.js"]
