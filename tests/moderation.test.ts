import { spawn } from "node:child_process";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { admins, comments, moderationActions, posts, users } from "@/db/schema";
import { HANDLE_RE } from "@/lib/limits";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: s.ServiceError) => e.code,
  );
const post = async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0];
const comment = async (id: string) =>
  (await db.select().from(comments).where(eq(comments.id, id)))[0];
const user = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];
const logFor = (col: "postId" | "commentId" | "userId", id: string) =>
  db.select().from(moderationActions).where(eq(moderationActions[col], id));

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeAll(async () => {
  admin = await makeUser("מנהלת");
  await db.insert(admins).values({ userId: admin.id }); // as scripts/admin.mjs would
});

describe("authorization", () => {
  test("non-admins can't moderate; a revoked admin can't either", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    expect(await code(s.removePost(b.id, p.id, "סיבה"))).toBe("forbidden");
    expect(await code(s.suspendUser(b.id, a.id, "סיבה"))).toBe("forbidden");
    expect(await code(s.grantAdmin(b.id, b.handle, "סיבה"))).toBe("forbidden");

    await s.grantAdmin(admin.id, b.handle, "צוות");
    expect(await s.isAdmin(b.id)).toBe(true);
    await s.revokeAdmin(admin.id, b.id, "סוף תפקיד");
    expect(await s.isAdmin(b.id)).toBe(false);
    expect(await code(s.removePost(b.id, p.id, "סיבה"))).toBe("forbidden");
    expect((await post(p.id)).deletedAt).toBeNull();
  });

  test("a reason is required; admins can't revoke or suspend themselves", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט");
    expect(await code(s.removePost(admin.id, p.id, "  "))).toBe("invalid");
    expect(await code(s.removePost(admin.id, p.id, "x".repeat(301)))).toBe("invalid");
    expect(await code(s.revokeAdmin(admin.id, admin.id, "סיבה"))).toBe("invalid");
    expect(await code(s.suspendUser(admin.id, admin.id, "סיבה"))).toBe("invalid");
  });
});

describe("posts and comments", () => {
  test("remove and restore a post: hidden from feeds, audited, author can't undo it", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "תוכן פוגעני");
    await s.removePost(admin.id, p.id, "פוגעני");
    const removed = await post(p.id);
    expect(removed.deletedAt).not.toBeNull();
    expect(removed.removedAt).not.toBeNull();
    const feed = await s.feedPage(a.id, { view: "latest", authorId: a.id });
    expect(feed.items.map((i) => i.id)).not.toContain(p.id);
    expect(await code(s.editPost(a.id, p.id, "ניסיון"))).toBe("gone");
    expect(await code(s.removePost(admin.id, p.id, "שוב"))).toBe("gone");

    await s.restorePost(admin.id, p.id, "טעות");
    expect(await post(p.id)).toMatchObject({ deletedAt: null, removedAt: null });
    const log = await logFor("postId", p.id);
    expect(log.map((l) => [l.action, l.actorId, l.reason])).toEqual([
      ["remove_post", admin.id, "פוגעני"],
      ["restore_post", admin.id, "טעות"],
    ]);
  });

  test("an author's own delete can't be restored by a moderator", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט");
    await s.deletePost(a.id, p.id);
    expect(await code(s.restorePost(admin.id, p.id, "סיבה"))).toBe("gone");
    expect(await code(s.restorePost(admin.id, crypto.randomUUID(), "סיבה"))).toBe("not_found");
  });

  test("remove and restore a comment keep the counter right; the thread shows a placeholder", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(b.id, p.id, "תגובה");
    await s.createComment(a.id, p.id, "תשובה", c.id);
    expect((await post(p.id)).commentCount).toBe(2);

    await s.removeComment(admin.id, c.id, "ספאם");
    expect((await post(p.id)).commentCount).toBe(1);
    expect((await comment(c.id)).removedAt).not.toBeNull();
    const [node] = (await s.getThread(p.id, null)).nodes;
    expect(node).toMatchObject({ deleted: true, removed: true, body: null });

    await s.restoreComment(admin.id, c.id, "טעות");
    expect((await post(p.id)).commentCount).toBe(2);
    expect((await s.getThread(p.id, null)).nodes[0]).toMatchObject({
      removed: false,
      body: "תגובה",
    });
  });
});

describe("users", () => {
  test("a suspended user can't write anything, not even delete or undo", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const own = await s.createPost(a.id, "שלי");
    const other = await s.createPost(b.id, "של אחר");
    await s.likePost(a.id, other.id);
    await s.follow(a.id, b.id);
    const mine = await s.createComment(a.id, other.id, "תגובה שלי");

    await s.suspendUser(admin.id, a.id, "הטרדה");
    await s.suspendUser(admin.id, a.id, "שוב"); // no-op, not logged twice
    expect((await logFor("userId", a.id)).length).toBe(1);

    expect(await code(s.createPost(a.id, "x"))).toBe("suspended");
    expect(await code(s.editPost(a.id, own.id, "x"))).toBe("suspended");
    expect(await code(s.createComment(a.id, other.id, "x"))).toBe("suspended");
    expect(await code(s.likePost(a.id, own.id))).toBe("suspended");
    expect(await code(s.follow(a.id, admin.id))).toBe("suspended");
    expect(await code(s.updateProfile(a.id, { handle: a.handle, bio: "x" }))).toBe("suspended");
    expect(await code(s.unlikePost(a.id, other.id))).toBe("suspended");
    expect(await code(s.unfollow(a.id, b.id))).toBe("suspended");
    expect(await code(s.deletePost(a.id, own.id))).toBe("suspended");
    expect(await code(s.deleteComment(a.id, mine.id))).toBe("suspended");
    expect(await code(s.finishOnboarding(a.id))).toBe("suspended");
    expect((await s.suspendedUsers()).map((u) => u.id)).toContain(a.id);

    await s.unsuspendUser(admin.id, a.id, "הסתיים");
    expect(await code(s.createPost(a.id, "חזרתי"))).toBe("ok");
    expect(await code(s.deletePost(a.id, own.id))).toBe("ok");
  });

  test("admins can't be suspended until revoked", async () => {
    const b = await makeUser();
    await s.grantAdmin(admin.id, `@${b.handle.toUpperCase()}`, "צוות"); // @ and case ignored
    expect(await code(s.suspendUser(admin.id, b.id, "סיבה"))).toBe("forbidden");
    await s.revokeAdmin(admin.id, b.id, "סיבה");
    expect(await code(s.suspendUser(admin.id, b.id, "סיבה"))).toBe("ok");
  });

  test("clear bio and reset handle keep the old values in the log", async () => {
    const a = await makeUser();
    await s.updateProfile(a.id, { handle: a.handle, bio: "ביו פוגעני" });
    await s.clearBio(admin.id, a.id, "פוגעני");
    expect((await user(a.id)).bio).toBe("");

    await s.resetHandle(admin.id, a.id, "כינוי פוגעני");
    const after = await user(a.id);
    expect(after.handle).not.toBe(a.handle);
    expect(after.handle).toMatch(HANDLE_RE);
    expect(after.onboardedAt).toBeNull(); // back through the welcome
    const log = await logFor("userId", a.id);
    expect(log.map((l) => [l.action, l.detail])).toEqual([
      ["clear_bio", "ביו פוגעני"],
      ["reset_handle", a.handle],
    ]);
    // The old handle is free again.
    const c = await makeUser();
    await s.updateProfile(c.id, { handle: a.handle, bio: "" });
  });

  test("the log lists newest first with targets", async () => {
    const a = await makeUser();
    const p = await s.createPost(a.id, "פוסט ללוג");
    await s.removePost(admin.id, p.id, "ללוג");
    const [first] = await s.moderationLog(5);
    expect(first).toMatchObject({
      action: "remove_post",
      reason: "ללוג",
      actor: { handle: admin.handle },
      post: { id: p.id, preview: "פוסט ללוג" },
    });
    expect(first.post!.removedAt).not.toBeNull();
  });
});

describe("scripts/admin.mjs", () => {
  const run = (...args: string[]) =>
    new Promise<{ code: number | null; out: string }>((resolve) => {
      const p = spawn(process.execPath, ["scripts/admin.mjs", ...args], { env: process.env });
      let out = "";
      p.stdout.on("data", (d) => (out += d));
      p.stderr.on("data", (d) => (out += d));
      p.on("close", (code) => resolve({ code, out }));
    });

  test("grant, list and revoke by handle, audited with no actor", async () => {
    const u = await makeUser();
    expect(await run("grant", `@${u.handle}`, "first", "admin")).toMatchObject({ code: 0 });
    expect(await s.isAdmin(u.id)).toBe(true);
    expect((await run("grant", u.handle, "again")).out).toContain("already");
    expect((await run("list")).out).toContain(`@${u.handle}`);
    expect(await run("revoke", u.handle, "done")).toMatchObject({ code: 0 });
    expect(await s.isAdmin(u.id)).toBe(false);
    const log = await logFor("userId", u.id);
    expect(log.map((l) => [l.action, l.actorId, l.reason])).toEqual([
      ["grant_admin", null, "first admin"],
      ["revoke_admin", null, "done"],
    ]);
  });

  test("refuses unknown users and missing reasons", async () => {
    expect((await run("grant", "nobody_here_x", "r")).code).toBe(1);
    expect((await run("grant", "someone")).code).toBe(2);
  });
});
