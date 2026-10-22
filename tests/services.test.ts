import { and, eq, isNull, sql as dsql } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { follows, likes, posts } from "@/db/schema";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";
import { EDIT_WINDOW_MINUTES, PINS_MAX, POLL_OPTION_MAX, POST_MAX } from "@/lib/limits";

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
    expect(await code(s.createPost(a.id, "   "))).toBe("empty"); // nothing to show
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

describe("pinned posts", () => {
  test(`up to ${PINS_MAX}, newest pin first; unpin; a deleted one isn't shown`, async () => {
    const [u, other] = [await makeUser(), await makeUser()];
    const posts = [];
    for (let i = 0; i <= PINS_MAX; i++) posts.push(await s.createPost(u.id, `פוסט ${i}`));
    const pins = async () => (await s.pinnedPosts(other.id, u.id)).map((p) => p.id);
    expect(await pins()).toEqual([]);

    for (const p of posts.slice(0, PINS_MAX)) await s.pinPost(u.id, p.id);
    expect((await pins()).sort()).toEqual(
      posts
        .slice(0, PINS_MAX)
        .map((p) => p.id)
        .sort(),
    );
    expect(await code(s.pinPost(u.id, posts[PINS_MAX].id))).toBe("pin_limit");
    await s.pinPost(u.id, posts[0].id); // already pinned: fine, not a fourth

    await s.unpinPost(u.id, posts[0].id);
    expect(await pins()).not.toContain(posts[0].id);
    await s.deletePost(u.id, posts[1].id);
    expect(await pins()).not.toContain(posts[1].id);
    expect((await s.getPost(posts[2].id, u.id))?.pinned).toBe(true);
  });

  test("only your own post", async () => {
    const [u, other] = [await makeUser(), await makeUser()];
    const theirs = await s.createPost(other.id, "לא שלי");
    expect(await code(s.pinPost(u.id, theirs.id))).toBe("forbidden");
  });
});

describe("who to follow", () => {
  test("not yourself, not people you follow; most liked recently first", async () => {
    const [viewer, followed, quiet, liked, fan] = await Promise.all(
      Array.from({ length: 5 }, () => makeUser()),
    );
    await s.follow(viewer.id, followed.id);
    const post = await s.createPost(liked.id, "פוסט אהוב");
    await s.likePost(fan.id, post.id);
    const ids = (await s.whoToFollow(viewer.id, 1000)).map((u) => u.id);
    expect(ids).not.toContain(viewer.id);
    expect(ids).not.toContain(followed.id);
    expect(ids).toContain(quiet.id);
    expect(ids.indexOf(liked.id)).toBeLessThan(ids.indexOf(quiet.id));
  });
});

describe("empty posts", () => {
  test("a post or comment with nothing to show is refused", async () => {
    const u = await makeUser();
    expect(await code(s.createPost(u.id, "```\n```"))).toBe("empty");
    expect(await code(s.createPost(u.id, "‏ "))).toBe("empty");
    const post = await s.createPost(u.id, "יש תוכן");
    expect(await code(s.createComment(u.id, post.id, "****"))).toBe("empty");
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

describe("polls", () => {
  const options = ["כן", "לא", "אולי"];

  test("validates options and duration", async () => {
    const a = await makeUser();
    const bad = (poll: s.PollInput) => code(s.createPost(a.id, "שאלה?", poll));
    expect(await bad({ options: ["רק אחת"], minutes: 60 })).toBe("invalid");
    expect(await bad({ options: ["א", "ב", "ג", "ד", "ה"], minutes: 60 })).toBe("invalid");
    expect(await bad({ options: ["כן", " "], minutes: 60 })).toBe("invalid");
    expect(await bad({ options: ["כן", "כן"], minutes: 60 })).toBe("invalid");
    expect(await bad({ options: ["כן", "א".repeat(POLL_OPTION_MAX + 1)], minutes: 60 })).toBe(
      "invalid",
    );
    expect(await bad({ options: ["כן", "לא"], minutes: 4 })).toBe("invalid"); // under 5 minutes
    expect(await bad({ options: ["כן", "לא"], minutes: 7 * 24 * 60 + 1 })).toBe("invalid");
    expect(await code(s.createPost(a.id, "", { options, minutes: 60 }))).toBe("empty"); // needs a question
  });

  test("one final vote per person; counts and the viewer's choice; edits keep the poll", async () => {
    const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שאלה?", { options, minutes: 3 * 24 * 60 });
    expect((await s.getPost(p.id, b.id))?.poll).toMatchObject({
      options,
      open: true,
      counts: [0, 0, 0],
      mine: null,
    });
    await s.votePoll(b.id, p.id, 1);
    await s.votePoll(b.id, p.id, 2); // already voted: ignored
    await s.votePoll(c.id, p.id, 1);
    expect((await s.getPost(p.id, b.id))?.poll).toMatchObject({ counts: [0, 2, 0], mine: 1 });
    expect((await s.getPost(p.id, a.id))?.poll?.mine).toBeNull();
    expect(await code(s.votePoll(c.id, p.id, 3))).toBe("invalid");

    await s.editPost(a.id, p.id, "שאלה אחרת?");
    expect((await s.getPost(p.id, b.id))?.poll?.counts).toEqual([0, 2, 0]);

    const plain = await s.createPost(a.id, "בלי סקר");
    expect((await s.getPost(plain.id, b.id))?.poll).toBeNull();
    expect(await code(s.votePoll(b.id, plain.id, 0))).toBe("not_found");
  });

  test("no votes after the poll ends or on a deleted post", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "שאלה?", { options, minutes: 60 });
    await db
      .update(posts)
      .set({ pollEndsAt: dsql`now() - interval '1 second'` })
      .where(eq(posts.id, p.id));
    expect(await code(s.votePoll(b.id, p.id, 0))).toBe("poll_closed");
    expect((await s.getPost(p.id, b.id))?.poll?.open).toBe(false);

    const q = await s.createPost(a.id, "שאלה?", { options, minutes: 60 });
    await s.deletePost(a.id, q.id);
    expect(await code(s.votePoll(b.id, q.id, 0))).toBe("gone");
  });
});

describe("profession badge", () => {
  test("pick one of the list, change it, clear it; others are refused", async () => {
    const u = await makeUser();
    const save = (profession?: string | null) =>
      s.updateProfile(u.id, { handle: u.handle!, bio: "", profession });
    expect((await save("devops")).profession).toBe("devops");
    expect((await save(undefined)).profession).toBe("devops"); // not sent: kept
    expect((await save("qa")).profession).toBe("qa");
    expect((await save("cyber")).profession).toBe("cyber");
    expect((await save(null)).profession).toBeNull();
    expect(await code(save("ceo"))).toBe("invalid");
  });
});

describe("bookmarks, liked and replies lists", () => {
  test("save and unsave posts and comments; newest first; deleted ones drop out", async () => {
    const [u, a] = [await makeUser(), await makeUser()];
    const p1 = await s.createPost(a.id, "ראשון");
    const p2 = await s.createPost(a.id, "שני");
    const c = await s.createComment(a.id, p1.id, "תגובה");
    await s.setBookmark(u.id, { postId: p1.id }, true);
    await s.setBookmark(u.id, { commentId: c.id }, true);
    await s.setBookmark(u.id, { postId: p2.id }, true);
    await s.setBookmark(u.id, { postId: p2.id }, true); // twice: one
    const ids = async () =>
      (await s.savedPage(u.id, null)).items.map((x) =>
        x.kind === "post" ? x.post.id : x.comment.id,
      );
    expect(await ids()).toEqual([p2.id, c.id, p1.id]);
    expect((await s.getPost(p2.id, u.id))?.bookmarked).toBe(true);
    expect((await s.getPost(p2.id, a.id))?.bookmarked).toBe(false); // private

    await s.setBookmark(u.id, { postId: p2.id }, false);
    await s.deletePost(a.id, p1.id); // its comment goes with it
    expect(await ids()).toEqual([]);
    expect(await code(s.setBookmark(u.id, { postId: p1.id }, true))).toBe("gone");
  });

  test("liked: posts and comments together, newest first; replies: a user's comments", async () => {
    const [u, a] = [await makeUser(), await makeUser()];
    const p = await s.createPost(a.id, "פוסט");
    const c = await s.createComment(a.id, p.id, "תגובה");
    const r = await s.createComment(u.id, p.id, "תשובה", c.id);
    await s.likePost(u.id, p.id);
    await s.likeComment(u.id, c.id);
    const liked = (await s.likedPage(u.id, null)).items;
    expect(liked.map((x) => x.kind)).toEqual(["comment", "post"]);

    const replies = (await s.repliesPage(a.id, u.id, null)).items;
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ kind: "comment", comment: { id: r.id, replyTo: a.handle } });
  });
});

describe("people by profession", () => {
  test("only that badge, with the viewer's follow state", async () => {
    const [v, de, other] = [await makeUser(), await makeUser(), await makeUser()];
    await s.updateProfile(de.id, { handle: de.handle!, bio: "", profession: "data_engineer" });
    await s.updateProfile(other.id, { handle: other.handle!, bio: "", profession: "qa" });
    await s.follow(v.id, de.id);
    const got = await s.peopleByProfession(v.id, "data_engineer");
    expect(got.find((u) => u.id === de.id)).toMatchObject({ viewerFollows: true });
    expect(got.some((u) => u.id === other.id)).toBe(false);
  });
});

describe("people lists know whom you follow", () => {
  // These columns sat in subqueries as a bare "id", which matched the subquery's own table.
  test("search shows the follow state; suggestions skip people you follow", async () => {
    const [v, t] = [await makeUser("זזזבדיקה"), await makeUser("זזזבדיקה")];
    await s.follow(v.id, t.id);
    expect((await s.searchUsers(v.id, t.handle!)).find((u) => u.id === t.id)?.viewerFollows).toBe(
      true,
    );
    expect((await s.suggestedUsers(v.id, 1000)).some((u) => u.id === t.id)).toBe(false);
  });
});
