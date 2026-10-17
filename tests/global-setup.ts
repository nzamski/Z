// Resets the test database and applies all migrations once per `npm test` run.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function setup() {
  const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
  await sql`drop schema if exists public cascade`;
  await sql`drop schema if exists drizzle cascade`;
  await sql`create schema public`;
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  await sql.end();
}
