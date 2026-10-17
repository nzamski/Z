import { and, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { follows, likes, posts } from "@/db/schema";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";
import { POST_MAX } from "@/lib/limits";

afterAll(() => sql.end());

const post = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: s.ServiceError) => e.code,
  );

describe("posts", () => {
  test("create computes preview; edit recomputes it and sets edited_at; delete is soft", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "קצר");
    expect(p).toMatchObject({ preview: "קצר", hasMore: false, editedAt: null });

    const long = "מילה ".repeat(300);
    const e = await s.editPost(a.id, p.id, long);
    expect(e.hasMore).toBe(true);
    expect(e.editedAt).not.toBeNull();

    await s.deletePost(a.id, p.id);
    expect((await post(p.id)).deletedAt).not.toBeNull();
  });

  test("rejects bodies over the limit and blank bodies", async () => {
    const a = await makeUser();
    expect(await code(s.createPost(a.id, "א".repeat(POST_MAX + 1)))).toBe("invalid");
    expect(await code(s.createPost(a.id, "   "))).toBe("invalid");
  });

  test("only the author can edit or delete", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שלום");
    expect(await code(s.editPost(b.id, p.id, "x"))).toBe("forbidden");
    expect(await code(s.deletePost(b.id, p.id))).toBe("forbidden");
  });
});

describe("likes", () => {
  test("like, duplicate like, unlike, re-like keep the counter right and soft-delete", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");

    await s.likePost(b.id, p.id);
    await s.likePost(b.id, p.id); // no-op
    expect((await post(p.id)).likeCount).toBe(1);

    await s.unlikePost(b.id, p.id);
    await s.unlikePost(b.id, p.id); // no-op
    expect((await post(p.id)).likeCount).toBe(0);

    await s.likePost(b.id, p.id);
    expect((await post(p.id)).likeCount).toBe(1);

    const rows = await db.select().from(likes).where(eq(likes.postId, p.id));
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.deletedAt === null)).toHaveLength(1);
  });

  test("likes on a deleted post are rejected", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    await s.deletePost(a.id, p.id);
    expect(await code(s.likePost(b.id, p.id))).toBe("gone");
    expect((await post(p.id)).likeCount).toBe(0);
  });
});

describe("comments", () => {
  test("counts every live comment at any depth; deleting a parent keeps replies counted", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c1 = await s.createComment(b.id, p.id, "תגובה");
    const c2 = await s.createComment(a.id, p.id, "תשובה", c1.id);
    await s.createComment(b.id, p.id, "עמוק", c2.id);
    expect((await post(p.id)).commentCount).toBe(3);

    await s.deleteComment(b.id, c1.id);
    expect((await post(p.id)).commentCount).toBe(2);
    await s.deleteComment(b.id, c1.id).catch(() => {}); // already deleted: no double decrement
    expect((await post(p.id)).commentCount).toBe(2);
  });

  test("edit sets edited_at; only the author can edit or delete", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(b.id, p.id, "תגובה");
    expect(await code(s.editComment(a.id, c.id, "x"))).toBe("forbidden");
    expect(await code(s.deleteComment(a.id, c.id))).toBe("forbidden");
    expect((await s.editComment(b.id, c.id, "ערוך")).editedAt).not.toBeNull();
  });

  test("rejects comments on deleted posts, replies to deleted comments, cross-post parents", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const other = await s.createPost(a.id, "אחר");
    const c = await s.createComment(b.id, p.id, "תגובה");
    expect(await code(s.createComment(b.id, other.id, "x", c.id))).toBe("not_found");

    await s.deleteComment(b.id, c.id);
    expect(await code(s.createComment(a.id, p.id, "x", c.id))).toBe("gone");

    await s.deletePost(a.id, p.id);
    expect(await code(s.createComment(b.id, p.id, "x"))).toBe("gone");
    expect((await post(p.id)).commentCount).toBe(0);
  });
});

describe("follows", () => {
  test("follow, duplicate, unfollow, re-follow; self-follow rejected", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await s.follow(a.id, b.id);
    await s.follow(a.id, b.id);
    await s.unfollow(a.id, b.id);
    await s.follow(a.id, b.id);
    const rows = await db.select().from(follows).where(eq(follows.followerId, a.id));
    expect(rows).toHaveLength(2);
    const live = await db
      .select()
      .from(follows)
      .where(and(eq(follows.followerId, a.id), isNull(follows.deletedAt)));
    expect(live).toHaveLength(1);
    expect(await code(s.follow(a.id, a.id))).toBe("invalid");
  });
});
