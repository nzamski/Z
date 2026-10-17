import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

// Raw SQL that never mentions updated_at must still advance it (PLAN.md M1).
test("set_updated_at() advances updated_at on every table", async () => {
  const [a, b] = [await makeUser(), await makeUser()];
  const p = await s.createPost(a.id, "פוסט");
  const c = await s.createComment(b.id, p.id, "תגובה");
  await s.likePost(b.id, p.id);
  await s.follow(a.id, b.id);
  const [like] = await sql`select id from likes where post_id = ${p.id}`;
  const [fol] = await sql`select id from follows where follower_id = ${a.id}`;

  const rows: [string, string, string][] = [
    ["users", a.id, "bio = 'x'"],
    ["posts", p.id, "body = 'x'"],
    ["comments", c.id, "body = 'x'"],
    ["likes", like.id, "deleted_at = now()"],
    ["follows", fol.id, "deleted_at = now()"],
    ["posts", p.id, "deleted_at = now()"],
  ];
  for (const [table, id, set] of rows) {
    const [before] = await sql`select updated_at::text as t from ${sql(table)} where id = ${id}`;
    await sql.unsafe(`update "${table}" set ${set} where id = $1`, [id]);
    const [r] =
      await sql`select updated_at > ${before.t}::timestamptz as advanced from ${sql(table)} where id = ${id}`;
    expect(r.advanced, `${table}: ${set}`).toBe(true);
  }
});
