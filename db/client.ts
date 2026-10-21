import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// TLS: `?sslmode=require` (or verify-full) in DATABASE_URL; DATABASE_CA_FILE adds a private CA
// (e.g. a mounted ConfigMap with the platform's root certificate).
const ca = process.env.DATABASE_CA_FILE;
// Dev: one pool across hot reloads (each reload of this module used to open another, until
// Postgres ran out of connections).
const g = globalThis as { zSql?: postgres.Sql };
export const sql =
  g.zSql ??
  postgres(process.env.DATABASE_URL!, ca ? { ssl: { ca: readFileSync(ca, "utf8") } } : {});
if (process.env.NODE_ENV === "development") g.zSql = sql; // not tests: they end it per file
export const db = drizzle(sql, { schema });
