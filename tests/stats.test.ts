import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { STATS_DAYS, usageStats } from "@/lib/stats";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

// Other test files write at the same time, so this checks shape and relationships, plus that
// this test's own activity shows up, rather than exact totals.
test("usage stats: daily series end today, counts add up, own activity shows", async () => {
  const [a, b] = [await makeUser(), await makeUser()];
  await s.recordVisit(a.id);
  const p = await s.createPost(a.id, "שאלה לסטטיסטיקה?");
  const c = await s.createComment(b.id, p.id, "תשובה");
  await s.likeComment(a.id, c.id);
  await s.likePost(b.id, p.id);

  const st = await usageStats();
  for (const series of [st.visits, st.posts, st.comments, st.likes]) {
    expect(series).toHaveLength(STATS_DAYS);
    expect(series.at(-1)!.day).toBe(st.today);
    expect(series.map((d) => d.day)).toEqual([...series.map((d) => d.day)].sort());
  }
  expect(st.visits.at(-1)!.n).toBeGreaterThanOrEqual(1);
  expect(st.active.today).toBeGreaterThanOrEqual(1);
  expect(st.active.today).toBeLessThanOrEqual(st.active.week);
  expect(st.active.week).toBeLessThanOrEqual(st.active.month);
  expect(st.posts.at(-1)!.n).toBeGreaterThanOrEqual(1);
  expect(st.likes.at(-1)!.n).toBeGreaterThanOrEqual(2);
  const conv = st.conversation;
  expect(conv.commented).toBeGreaterThanOrEqual(1);
  expect(conv.commented).toBeLessThanOrEqual(conv.posts);
  expect(conv.answered).toBeGreaterThanOrEqual(1); // a's question, b's answer liked by a
  expect(conv.answered).toBeLessThanOrEqual(conv.questions);
  expect(conv.medianMinutes).not.toBeNull();
  expect(st.features.answers).toBeGreaterThanOrEqual(1);
  expect(st.contributors.length).toBeLessThanOrEqual(10);
});
