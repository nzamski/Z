import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { comments } from "@/db/schema";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const comment = async (id: string) =>
  (await db.select().from(comments).where(eq(comments.id, id)))[0];
const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: s.ServiceError) => e.code,
  );

describe("comment likes", () => {
  test("like, duplicate, unlike, re-like keep like_count right", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שאלה");
    const c = await s.createComment(b.id, p.id, "תשובה");
    await s.likeComment(b.id, c.id); // own comment: a like, not an author mark
    await s.likeComment(b.id, c.id);
    expect(await comment(c.id)).toMatchObject({ likeCount: 1, authorLikedAt: null });
    await s.unlikeComment(b.id, c.id);
    await s.unlikeComment(b.id, c.id);
    expect((await comment(c.id)).likeCount).toBe(0);
    await s.likeComment(b.id, c.id);
    expect((await comment(c.id)).likeCount).toBe(1);
  });

  test("the post author's like marks the comment; their unlike clears it", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שאלה");
    const c = await s.createComment(b.id, p.id, "תשובה");
    await s.likeComment(a.id, c.id);
    expect((await comment(c.id)).authorLikedAt).not.toBeNull();
    const card = (await s.feedPage(a.id, { view: "latest", authorId: a.id })).items[0];
    expect(card).toMatchObject({ id: p.id, answered: true });

    await s.unlikeComment(a.id, c.id);
    expect(await comment(c.id)).toMatchObject({ likeCount: 0, authorLikedAt: null });
    const again = (await s.feedPage(a.id, { view: "latest", authorId: a.id })).items[0];
    expect(again.answered).toBe(false);
  });

  test("the author's own comment never gets the mark; deleted comments can't be liked", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const own = await s.createComment(a.id, p.id, "הבהרה שלי");
    await s.likeComment(a.id, own.id);
    expect((await comment(own.id)).authorLikedAt).toBeNull();
    const c = await s.createComment(b.id, p.id, "תגובה");
    await s.deleteComment(b.id, c.id);
    expect(await code(s.likeComment(a.id, c.id))).toBe("gone");
    expect(await code(s.likeComment(a.id, crypto.randomUUID()))).toBe("not_found");
  });

  test("top-level order: author-liked, then most liked, then oldest; replies stay in time order", async () => {
    const [a, b, c, d] = [await makeUser(), await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שאלה");
    const first = await s.createComment(b.id, p.id, "ראשונה");
    const popular = await s.createComment(c.id, p.id, "פופולרית");
    const answer = await s.createComment(d.id, p.id, "התשובה");
    const r1 = await s.createComment(b.id, p.id, "תשובה 1", answer.id);
    const r2 = await s.createComment(c.id, p.id, "תשובה 2", answer.id);
    await s.likeComment(b.id, r2.id); // a liked reply doesn't jump ahead
    await s.likeComment(b.id, popular.id);
    await s.likeComment(d.id, popular.id);
    await s.likeComment(a.id, answer.id);

    const { nodes } = await s.getThread(p.id, null, 0, undefined, b.id);
    expect(nodes.map((n) => n.id)).toEqual([answer.id, popular.id, first.id]);
    expect(nodes[0]).toMatchObject({ authorLiked: true, likeCount: 1, liked: false });
    expect(nodes[1]).toMatchObject({ authorLiked: false, likeCount: 2, liked: true });
    expect(nodes[0].children.map((n) => n.id)).toEqual([r1.id, r2.id]);
  });

  test("suspended users can't like or unlike comments", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(a.id, p.id, "תגובה");
    await sql`update users set suspended_at = now() where id = ${b.id}`;
    expect(await code(s.likeComment(b.id, c.id))).toBe("suspended");
    expect(await code(s.unlikeComment(b.id, c.id))).toBe("suspended");
  });
});
