import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { admins } from "@/db/schema";
import { extractMentions, renderMarkdown } from "@/lib/markdown";
import { groupNotifications } from "@/lib/notifications";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const inbox = async (userId: string) =>
  (await s.notificationsPage(userId)).items.map((n) => [n.type, n.actor?.handle ?? null]);

describe("writes", () => {
  test("comments notify the post's author; replies the parent comment's author; never yourself", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const top = await s.createComment(b.id, p.id, "תגובה");
    await s.createComment(c.id, p.id, "תשובה", top.id);
    await s.createComment(a.id, p.id, "שלי"); // own post: nothing
    expect(await inbox(a.id)).toEqual([["comment", b.handle]]);
    expect(await inbox(b.id)).toEqual([["reply", c.handle]]);
    expect(await s.unreadNotifications(a.id)).toBe(1);
  });

  test("likes notify, unlikes take it back; the post author's like is 'author_liked'", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(b.id, p.id, "תשובה");
    await s.likePost(b.id, p.id);
    await s.likeComment(a.id, c.id);
    expect(await inbox(a.id)).toEqual([
      ["like_post", b.handle],
      ["comment", b.handle],
    ]);
    expect((await inbox(b.id))[0]).toEqual(["author_liked", a.handle]);
    await s.unlikePost(b.id, p.id);
    await s.unlikeComment(a.id, c.id);
    expect(await inbox(a.id)).toEqual([["comment", b.handle]]);
    expect(await inbox(b.id)).toEqual([]);
  });

  test("follow notifies, unfollow takes it back", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    await s.follow(b.id, a.id);
    expect(await inbox(a.id)).toEqual([["follow", b.handle]]);
    await s.unfollow(b.id, a.id);
    expect(await inbox(a.id)).toEqual([]);
  });

  test("mentions: posts and comments, once per person, edits notify only new mentions", async () => {
    const [a, b, c, d] = [await makeUser(), await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, `שאלה ל-@${b.handle} ול-@${b.handle.toUpperCase()}`);
    await s.editPost(a.id, p.id, `שאלה ל-@${b.handle} ול-@${c.handle}`);
    expect(await inbox(b.id)).toEqual([["mention_post", a.handle]]);
    expect(await inbox(c.id)).toEqual([["mention_post", a.handle]]);
    // A comment that mentions the post's author: one 'comment', no extra 'mention'.
    await s.createComment(d.id, p.id, `@${a.handle} וגם @${c.handle}`);
    expect(await inbox(a.id)).toEqual([["comment", d.handle]]);
    expect((await inbox(c.id))[0]).toEqual(["mention_comment", d.handle]);
    // Code and e-mail addresses are not mentions; unknown handles are ignored.
    await s.createPost(a.id, `\`@${b.handle}\` x@${b.handle}.com @nobody_here_123`);
    expect((await inbox(b.id)).length).toBe(1);
  });

  test("deleted posts/comments hide their notifications; moderation notices show with the reason", async () => {
    const [a, b, admin] = [await makeUser(), await makeUser(), await makeUser()];
    await db.insert(admins).values({ userId: admin.id });
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(b.id, p.id, "תגובה");
    await s.deleteComment(b.id, c.id);
    expect(await inbox(a.id)).toEqual([]);

    await s.removePost(admin.id, p.id, "לא מתאים");
    const [removed] = (await s.notificationsPage(a.id)).items;
    expect(removed).toMatchObject({ type: "removed_post", reason: "לא מתאים", postId: p.id });
    await s.restorePost(admin.id, p.id, "טעות");
    expect((await inbox(a.id)).map((n) => n[0])).toEqual(["restored_post", "removed_post"]);
  });

  test("mark read up to what was seen", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    await s.follow(b.id, a.id);
    const seen = (await s.notificationsPage(a.id)).items[0].id;
    await s.follow(c.id, a.id); // arrives after the page was loaded
    await s.markNotificationsRead(a.id, seen);
    expect(await s.unreadNotifications(a.id)).toBe(1);
    expect((await s.notificationsPage(a.id)).items.map((n) => n.unread)).toEqual([true, false]);
  });
});

describe("mentions in markdown", () => {
  test("@handle links to the profile, not in code, links or e-mail", () => {
    expect(renderMarkdown("שלום @Dana_1!")).toContain('<a href="/u/dana_1" class="mention"');
    expect(renderMarkdown("`@dana_1`")).not.toContain("mention");
    expect(renderMarkdown("dana@example.com")).not.toContain('class="mention"');
    // Exactly the handle rule (HANDLE_RE): 4-15 characters, starting with a letter.
    expect(extractMentions("@abc @abcd @abcdefghijklmno @abcdefghijklmnop @1abc")).toEqual([
      "abcd",
      "abcdefghijklmno",
    ]);
    expect(renderMarkdown("[@dana_1](https://x.example)")).not.toContain('class="mention"');
    expect(extractMentions("@aaaa @bbbb @aaaa `@dddd`\n\n```\n@cccc\n```")).toEqual([
      "aaaa",
      "bbbb",
    ]);
    expect(
      extractMentions(Array.from({ length: 20 }, (_, i) => `@user_${i}x`).join(" ")),
    ).toHaveLength(10);
  });
});

test("grouping: likes per item and follows collapse, newest first", () => {
  const row = (id: string, type: string, actor: string, postId: string | null = null) => ({
    id,
    type: type as s.NotificationRow["type"],
    createdAt: new Date(),
    unread: id === "1",
    postId,
    commentId: null,
    actor: { handle: actor, displayName: actor },
    postPreview: null,
    commentBody: null,
    reason: null,
  });
  const items = groupNotifications([
    row("1", "like_post", "dana", "p1"),
    row("2", "follow", "noa"),
    row("3", "like_post", "yossi", "p1"),
    row("4", "like_post", "dana", "p2"),
    row("5", "follow", "dana"),
  ]);
  expect(items.map((i) => [i.id, i.count, i.actors.map((a) => a.handle), i.unread])).toEqual([
    ["1", 2, ["dana", "yossi"], true],
    ["2", 2, ["noa", "dana"], false],
    ["4", 1, ["dana"], false],
  ]);
});
