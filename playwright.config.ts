import { defineConfig } from "@playwright/test";

// Needs Postgres + `docker compose up -d keycloak`. Reuses whatever already serves :3000 (dev
// server, or the production image in the M5 dry run, docs/deploy.md).
// E2E_DOCKER_HOST=1: the browser resolves host.docker.internal like the container does, so both
// see the same Keycloak issuer URL.
const dockerHost = process.env.E2E_DOCKER_HOST
  ? ["--host-resolver-rules=MAP host.docker.internal 127.0.0.1"]
  : [];

export default defineConfig({
  testDir: "e2e",
  workers: 1, // one shared dev DB and the same test users
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000", locale: "he-IL", launchOptions: { args: dockerHost } },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
