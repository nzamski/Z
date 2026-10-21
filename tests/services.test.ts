import { and, eq, isNull, sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { follows, likes, posts } from "@/db/schema";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";
import { EDIT_WINDOW_MINUTES, POST_MAX } from "@/lib/limits";

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

    const long = Array.from({ length: 15 }, (_, i) => `שורה ${i}`).join("\n"); // > 10 lines
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

  test("posts can be edited only within the edit window", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט");
    const back = async (minutes: number) =>
      db
        .update(posts)
        .set({ createdAt: dsql`now() - make_interval(mins => ${minutes})` })
        .where(eq(posts.id, p.id));
    await back(EDIT_WINDOW_MINUTES - 1);
    expect(await code(s.editPost(a.id, p.id, "עדיין אפשר"))).toBe("ok");
    await back(EDIT_WINDOW_MINUTES + 1);
    expect(await code(s.editPost(a.id, p.id, "מאוחר מדי"))).toBe("edit_window");
    expect((await post(p.id)).body).toBe("עדיין אפשר");
    expect(await code(s.deletePost(a.id, p.id))).toBe("ok"); // deleting has no window

    const now = Date.now();
    expect(s.canEditPost(new Date(now - (EDIT_WINDOW_MINUTES - 1) * 60_000), now)).toBe(true);
    expect(s.canEditPost(new Date(now - (EDIT_WINDOW_MINUTES + 1) * 60_000), now)).toBe(false);
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

  test("comments can't be edited; only the author can delete", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(b.id, p.id, "תגובה");
    expect("editComment" in s).toBe(false);
    expect(await code(s.deleteComment(a.id, c.id))).toBe("forbidden");
    expect(await code(s.deleteComment(b.id, c.id))).toBe("ok");
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

describe("pinned post", () => {
  test("pin your own post; a new pin replaces it; unpin; a deleted one isn't shown", async () => {
    const [u, other] = [await makeUser(), await makeUser()];
    const first = await s.createPost(u.id, "ראשון");
    const second = await s.createPost(u.id, "שני");
    expect(await s.pinnedPost(other.id, u.id)).toBeNull();

    await s.pinPost(u.id, first.id);
    expect((await s.pinnedPost(other.id, u.id))?.id).toBe(first.id);
    await s.pinPost(u.id, second.id);
    expect((await s.pinnedPost(other.id, u.id))?.id).toBe(second.id);

    await s.unpinPost(u.id);
    expect(await s.pinnedPost(other.id, u.id)).toBeNull();

    await s.pinPost(u.id, first.id);
    await s.deletePost(u.id, first.id);
    expect(await s.pinnedPost(other.id, u.id)).toBeNull();
  });

  test("only your own post", async () => {
    const [u, other] = [await makeUser(), await makeUser()];
    const theirs = await s.createPost(other.id, "לא שלי");
    expect(await code(s.pinPost(u.id, theirs.id))).toBe("forbidden");
  });
});

describe("postSummaries (a feed shown again re-checks its cards)", () => {
  test("current counts and the viewer's like; deleted posts are left out", async () => {
    const author = await makeUser();
    const viewer = await makeUser();
    const kept = await s.createPost(author.id, "נשאר");
    const gone = await s.createPost(author.id, "נמחק");
    await s.likePost(viewer.id, kept.id);
    await s.createComment(viewer.id, kept.id, "תגובה");
    await s.deletePost(author.id, gone.id);
    const got = await s.postSummaries(viewer.id, [kept.id, gone.id]);
    expect(got.map((x) => x.id)).toEqual([kept.id]);
    expect(got[0]).toMatchObject({ likeCount: 1, commentCount: 1, liked: true });
  });
});
