import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    env: {
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://z:z@localhost:5433/z_test",
    },
  },
});
