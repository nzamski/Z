import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

const sql = postgres(process.env.DATABASE_URL!);
afterAll(() => sql.end());

test("connects to the test Postgres", async () => {
  const [row] =
    await sql`select current_database() as db, current_setting('server_version_num')::int as v`;
  expect(row.db).toBe("z_test");
  expect(row.v).toBeGreaterThanOrEqual(160000);
});
