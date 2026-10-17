import { defineConfig } from "@playwright/test";

// Needs `docker compose up -d db keycloak`. Reuses a running `npm run dev` if there is one.
export default defineConfig({
  testDir: "e2e",
  workers: 1, // one shared dev DB and the same test users
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: "http://localhost:3000", locale: "he-IL" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    env: { NEXT_TELEMETRY_DISABLED: "1" },
  },
});
