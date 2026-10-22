import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

// Raw SQL that never mentions updated_at must still advance it.
test("set_updated_at() advances updated_at on every table", async () => {
  const [a, b] = [await makeUser(), await makeUser()];
  const p = await s.createPost(a.id, "פוסט");
  const c = await s.createComment(b.id, p.id, "תגובה");
  await s.likePost(b.id, p.id);
  await s.follow(a.id, b.id);
  const [like] = await sql`select id from likes where post_id = ${p.id}`;
  await s.likeComment(a.id, c.id);
  const [clike] = await sql`select id from comment_likes where comment_id = ${c.id}`;
  const [fol] = await sql`select id from follows where follower_id = ${a.id}`;
  const [adm] = await sql`insert into admins (user_id) values (${a.id}) returning id`;
  const [notif] = await sql`select id from notifications where recipient_id = ${a.id} limit 1`;
  const poll = await s.createPost(a.id, "סקר", { options: ["כן", "לא"], minutes: 60 });
  await s.votePoll(b.id, poll.id, 0);
  const [vote] = await sql`select id from poll_votes where post_id = ${poll.id}`;
  await s.setBookmark(b.id, { postId: p.id }, true);
  const [bm] = await sql`select id from bookmarks where post_id = ${p.id}`;
  const [rep] = await sql`insert into reports (reporter_id, post_id, reason)
    values (${b.id}, ${p.id}, 'spam') returning id`;
  const [visit] = await sql`insert into daily_visits (user_id, day)
    values (${a.id}, '2026-01-01') returning id`;
  const [mod] = await sql`insert into moderation_actions (action, user_id, reason)
    values ('suspend_user', ${b.id}, 'test') returning id`;

  const rows: [string, string, string][] = [
    ["users", a.id, "bio = 'x'"],
    ["posts", p.id, "body = 'x'"],
    ["comments", c.id, "body = 'x'"],
    ["likes", like.id, "deleted_at = now()"],
    ["comment_likes", clike.id, "deleted_at = now()"],
    ["follows", fol.id, "deleted_at = now()"],
    ["posts", p.id, "deleted_at = now()"],
    ["admins", adm.id, "deleted_at = now()"],
    ["moderation_actions", mod.id, "reason = 'x'"],
    ["reports", rep.id, "note = 'x'"],
    ["daily_visits", visit.id, "deleted_at = now()"],
    ["notifications", notif.id, "read_at = now()"],
    ["poll_votes", vote.id, "deleted_at = now()"],
    ["bookmarks", bm.id, "deleted_at = now()"],
  ];
  for (const [table, id, set] of rows) {
    const [before] = await sql`select updated_at::text as t from ${sql(table)} where id = ${id}`;
    await sql.unsafe(`update "${table}" set ${set} where id = $1`, [id]);
    const [r] =
      await sql`select updated_at > ${before.t}::timestamptz as advanced from ${sql(table)} where id = ${id}`;
    expect(r.advanced, `${table}: ${set}`).toBe(true);
  }
});
