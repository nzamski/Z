import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env itself; real envs inject vars directly.
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
