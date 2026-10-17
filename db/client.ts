import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// TLS: `?sslmode=require` (or verify-full) in DATABASE_URL; DATABASE_CA_FILE adds a private CA
// (e.g. a mounted ConfigMap with the platform's root certificate).
const ca = process.env.DATABASE_CA_FILE;
export const sql = postgres(
  process.env.DATABASE_URL!,
  ca ? { ssl: { ca: readFileSync(ca, "utf8") } } : {},
);
export const db = drizzle(sql, { schema });
