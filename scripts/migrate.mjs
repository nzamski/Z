// Apply pending migrations (drizzle/), then exit. Shipped in the image as `node migrate.mjs`
// (PLAN.md §9): run it from a Helm pre-install/pre-upgrade hook Job, or from an init container.
//
// A Postgres advisory lock serializes concurrent runs (several replicas' init containers): the
// first applies, the rest wait and then find nothing to do. Same bookkeeping table as
// `npm run db:migrate` (drizzle.__drizzle_migrations), so both can be used on one database.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const LOCK = 7_310_001; // arbitrary, fixed: "Z migrations"
const here = dirname(fileURLToPath(import.meta.url));
const folder = process.env.MIGRATIONS_DIR ?? join(here, "drizzle");

if (!process.env.DATABASE_URL) {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}
const ca = process.env.DATABASE_CA_FILE;
// max: 1 keeps the lock and every migration statement on the same session.
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  onnotice: () => {},
  ...(ca ? { ssl: { ca: readFileSync(ca, "utf8") } } : {}),
});

try {
  console.log("migrate: waiting for lock");
  await sql`select pg_advisory_lock(${LOCK})`;
  await migrate(drizzle(sql), { migrationsFolder: folder });
  const [{ n }] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  console.log(`migrate: done, ${n} migrations applied in total`);
} catch (e) {
  console.error("migrate: failed:", e);
  process.exitCode = 1;
} finally {
  await sql`select pg_advisory_unlock(${LOCK})`.catch(() => {});
  await sql.end();
}
