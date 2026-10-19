import { afterAll, afterEach, beforeEach, describe, expect, test } from "vitest";
import { sql } from "@/db/client";
import { RATE } from "@/lib/limits";
import { allowSearch } from "@/lib/rate-limit";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: s.ServiceError) => e.code,
  );

describe("write limits (Postgres)", () => {
  const saved = structuredClone(RATE);
  beforeEach(() => {
    RATE.posts.max = 3;
    RATE.likes.max = 2;
    RATE.follows.max = 1;
    RATE.comments.max = 2;
  });
  afterEach(() => Object.assign(RATE, structuredClone(saved)));

  test("posts: the limit counts deleted posts too, per user", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const first = await s.createPost(a.id, "1");
    await s.createPost(a.id, "2");
    await s.deletePost(a.id, first.id); // deleting doesn't free a slot
    await s.createPost(a.id, "3");
    expect(await code(s.createPost(a.id, "4"))).toBe("rate_limited");
    expect(await code(s.createPost(b.id, "other user"))).toBe("ok");
    // Edits and deletes are not limited.
    const p = await s.createPost(b.id, "x");
    expect(await code(s.editPost(b.id, p.id, "y"))).toBe("ok");
  });

  test("comments, likes (re-likes count) and follows", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(b.id, "פוסט");
    await s.createComment(a.id, p.id, "1");
    await s.createComment(a.id, p.id, "2");
    expect(await code(s.createComment(a.id, p.id, "3"))).toBe("rate_limited");

    await s.likePost(a.id, p.id);
    await s.unlikePost(a.id, p.id);
    await s.likePost(a.id, p.id);
    await s.unlikePost(a.id, p.id);
    expect(await code(s.likePost(a.id, p.id))).toBe("rate_limited");
    expect(await code(s.unlikePost(a.id, p.id))).toBe("ok"); // undo is never limited

    await s.follow(a.id, b.id);
    expect(await code(s.follow(a.id, c.id))).toBe("rate_limited");
    expect(await code(s.unfollow(a.id, b.id))).toBe("ok");
  });
});

test("search (in memory): a sliding window per user", () => {
  const t0 = 1_000_000;
  const { max, minutes } = RATE.search;
  for (let i = 0; i < max; i++) expect(allowSearch("u1", t0 + i)).toBe(true);
  expect(allowSearch("u1", t0 + max)).toBe(false);
  expect(allowSearch("u2", t0 + max)).toBe(true); // per user
  expect(allowSearch("u1", t0 + minutes * 60_000 + 1)).toBe(true); // the first ones expired
});
