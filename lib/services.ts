// Service layer: every write goes through here (PLAN.md §3, §5). All deletes are soft.
import { randomBytes } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import {
  admins,
  commentLikes,
  comments,
  follows,
  likes,
  moderationActions,
  notifications,
  posts,
  postTags,
  topicFollows,
  users,
  type ModerationAction,
  type NotificationType,
} from "@/db/schema";
import {
  applyAuthorPenalty,
  decodeCursor,
  encodeCursor,
  RANKING,
  type Cursor,
  type FeedView,
} from "@/lib/feed";
import {
  BIO_MAX,
  COMMENT_MAX,
  EDIT_WINDOW_MINUTES,
  HANDLE_RE,
  POST_MAX,
  RATE,
  REASON_MAX,
} from "@/lib/limits";
import { extractMentions, extractTags } from "@/lib/markdown";
import { isTag, normalizeTag } from "@/lib/tags";
import { computePreview } from "@/lib/preview";
import { FUZZY, fuzzyText, toTsQuery } from "@/lib/search";

export class ServiceError extends Error {
  constructor(
    public code:
      | "invalid"
      | "not_found"
      | "forbidden"
      | "gone"
      | "taken"
      | "suspended"
      | "rate_limited"
      | "edit_window",
  ) {
    super(code);
  }
}

const PostBody = z.string().trim().min(1).max(POST_MAX);
const CommentBody = z.string().trim().min(1).max(COMMENT_MAX);
const Bio = z.string().trim().max(BIO_MAX);
const Handle = z.string().trim().toLowerCase().regex(HANDLE_RE);
const Reason = z.string().trim().min(1).max(REASON_MAX);
const now = sql`now()`;
const active = (t: { deletedAt: AnyPgColumn }) => isNull(t.deletedAt);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ServiceError("invalid");
  return r.data;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Bumps a counter on an active post; throws `gone` if the post is deleted, rolling back the
// transaction. Returns the post's author.
async function bumpPost(tx: Tx, postId: string, col: "likeCount" | "commentCount", by: 1 | -1) {
  const c = posts[col];
  const rows = await tx
    .update(posts)
    .set({ [col]: sql`${c} + ${by}`, updatedAt: now })
    .where(and(eq(posts.id, postId), active(posts)))
    .returning({ authorId: posts.authorId });
  if (!rows.length) throw new ServiceError("gone");
  return rows[0].authorId;
}

async function ownActive<T extends typeof posts | typeof comments>(
  table: T,
  id: string,
  actorId: string,
) {
  const [row] = await db
    .select({ authorId: table.authorId, deletedAt: table.deletedAt })
    .from(table as typeof posts)
    .where(eq(table.id, id));
  if (!row) throw new ServiceError("not_found");
  if (row.deletedAt) throw new ServiceError("gone");
  if (row.authorId !== actorId) throw new ServiceError("forbidden");
}

type WriteKind = "posts" | "comments" | "likes" | "commentLikes" | "follows";
const RATE_ROWS = {
  posts: [posts, posts.authorId],
  comments: [comments, comments.authorId],
  likes: [likes, likes.userId],
  commentLikes: [commentLikes, commentLikes.userId],
  follows: [follows, follows.followerId],
} as const;

/**
 * Suspended users can't write anything at all, not even delete or undo (they can't read either:
 * requireLogin sends them to /suspended). `kind`: also enforce that rate limit (RATE): the user's
 * rows of that kind in the trailing window, soft-deleted ones included, so deleting doesn't buy more.
 */
async function assertCanWrite(actorId: string, kind?: WriteKind) {
  let recent = sql<number>`0`;
  if (kind) {
    const [table, by] = RATE_ROWS[kind];
    recent = sql<number>`(select count(*)::int from ${table} where ${by} = ${actorId}
      and ${table.createdAt} > now() - make_interval(mins => ${RATE[kind].minutes}))`;
  }
  const [u] = await db
    .select({ suspendedAt: users.suspendedAt, recent })
    .from(users)
    .where(eq(users.id, actorId));
  if (u?.suspendedAt) throw new ServiceError("suspended");
  if (kind && u && u.recent >= RATE[kind].max) throw new ServiceError("rate_limited");
}

// ---- notification writes (docs/notifications.md) ----
// Written in the same transaction as the action; undoing the action soft-deletes them.

type Notice = {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  moderationActionId?: string;
};

async function notify(tx: Tx, n: Notice) {
  if (n.recipientId === n.actorId) return; // never about your own actions
  await tx.insert(notifications).values(n);
}

async function unnotify(
  tx: Tx,
  n: {
    actorId: string;
    types: NotificationType[];
    postId?: string;
    commentId?: string;
    recipientId?: string;
  },
) {
  await tx
    .update(notifications)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(notifications.actorId, n.actorId),
        inArray(notifications.type, n.types),
        n.postId ? eq(notifications.postId, n.postId) : undefined,
        n.commentId ? eq(notifications.commentId, n.commentId) : undefined,
        n.recipientId ? eq(notifications.recipientId, n.recipientId) : undefined,
        active(notifications),
      ),
    );
}

/** File a post under the #tags in its body (lib/tags.ts): new ones are added, ones that left the
 * body on an edit are soft-deleted (tombstones, like everything else). */
async function setPostTags(tx: Tx, postId: string, body: string) {
  const want = new Set(extractTags(body));
  const have = await tx
    .select({ id: postTags.id, tag: postTags.tag })
    .from(postTags)
    .where(and(eq(postTags.postId, postId), active(postTags)));
  const gone = have.filter((r) => !want.has(r.tag)).map((r) => r.id);
  if (gone.length)
    await tx
      .update(postTags)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(postTags.id, gone));
  const known = new Set(have.map((r) => r.tag));
  const added = [...want].filter((t) => !known.has(t));
  if (added.length)
    await tx
      .insert(postTags)
      .values(added.map((tag) => ({ postId, tag })))
      .onConflictDoNothing();
}

/**
 * Notifies the users @mentioned in `body` (at most MENTIONS_MAX), except the actor, `skip` (already
 * notified by this action), and anyone already notified of a mention in this post/comment (an edit
 * only notifies newly added mentions).
 */
async function notifyMentions(
  tx: Tx,
  actorId: string,
  body: string,
  target: { postId: string; commentId?: string },
  skip: string[] = [],
) {
  const handles = extractMentions(body);
  if (!handles.length) return;
  const type = target.commentId ? "mention_comment" : "mention_post";
  const found = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.handle, handles), active(users), ne(users.id, actorId)));
  for (const u of found) {
    if (skip.includes(u.id)) continue;
    const [already] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, u.id),
          eq(notifications.type, type),
          target.commentId
            ? eq(notifications.commentId, target.commentId)
            : and(eq(notifications.postId, target.postId), isNull(notifications.commentId)),
          active(notifications),
        ),
      );
    if (!already) await notify(tx, { recipientId: u.id, actorId, type, ...target });
  }
}

// ---- posts ----

export async function createPost(actorId: string, body: string) {
  const text = parse(PostBody, body);
  await assertCanWrite(actorId, "posts");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(posts)
      .values({ authorId: actorId, body: text, ...computePreview(text) })
      .returning();
    await notifyMentions(tx, actorId, text, { postId: row.id });
    await setPostTags(tx, row.id, text);
    return row;
  });
}

/** Only the author, and only within EDIT_WINDOW_MINUTES of publishing (the database's clock). */
export async function editPost(actorId: string, postId: string, body: string) {
  const text = parse(PostBody, body);
  await assertCanWrite(actorId);
  await ownActive(posts, postId, actorId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(posts)
      .set({ body: text, ...computePreview(text), editedAt: now, updatedAt: now })
      .where(
        and(
          eq(posts.id, postId),
          sql`${posts.createdAt} > now() - make_interval(mins => ${EDIT_WINDOW_MINUTES})`,
        ),
      )
      .returning();
    if (!row) throw new ServiceError("edit_window");
    await notifyMentions(tx, actorId, text, { postId });
    await setPostTags(tx, postId, text);
    return row;
  });
}

/** Whether the post's edit window is still open (for showing the edit button). */
export const canEditPost = (createdAt: Date, at = Date.now()) =>
  at - createdAt.getTime() < EDIT_WINDOW_MINUTES * 60_000;

export async function deletePost(actorId: string, postId: string) {
  await assertCanWrite(actorId);
  await ownActive(posts, postId, actorId);
  await db.update(posts).set({ deletedAt: now, updatedAt: now }).where(eq(posts.id, postId));
}

// ---- comments ----

export async function createComment(
  actorId: string,
  postId: string,
  body: string,
  parentCommentId?: string,
) {
  const text = parse(CommentBody, body);
  await assertCanWrite(actorId, "comments");
  return db.transaction(async (tx) => {
    let parentAuthorId: string | undefined;
    if (parentCommentId) {
      const [parent] = await tx
        .select({
          postId: comments.postId,
          authorId: comments.authorId,
          deletedAt: comments.deletedAt,
        })
        .from(comments)
        .where(eq(comments.id, parentCommentId));
      if (!parent || parent.postId !== postId) throw new ServiceError("not_found");
      if (parent.deletedAt) throw new ServiceError("gone");
      parentAuthorId = parent.authorId;
    }
    const postAuthorId = await bumpPost(tx, postId, "commentCount", 1);
    const [row] = await tx
      .insert(comments)
      .values({ postId, authorId: actorId, parentCommentId, body: text })
      .returning();
    // A reply notifies the comment's author; a top-level comment, the post's author.
    const recipientId = parentAuthorId ?? postAuthorId;
    const type = parentAuthorId ? "reply" : "comment";
    await notify(tx, { recipientId, actorId, type, postId, commentId: row.id });
    await notifyMentions(tx, actorId, text, { postId, commentId: row.id }, [recipientId]);
    return row;
  });
}

// Replies keep counting toward post.comment_count; only this comment is subtracted.
export async function deleteComment(actorId: string, commentId: string) {
  await assertCanWrite(actorId);
  await ownActive(comments, commentId, actorId);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(comments)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(comments.id, commentId), active(comments)))
      .returning({ postId: comments.postId });
    if (!row) return;
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} - 1`, updatedAt: now })
      .where(eq(posts.id, row.postId));
  });
}

// ---- likes ----

export async function likePost(actorId: string, postId: string) {
  await assertCanWrite(actorId, "likes");
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(likes)
      .values({ userId: actorId, postId })
      .onConflictDoNothing({ target: [likes.userId, likes.postId], where: active(likes) })
      .returning({ id: likes.id });
    if (inserted.length) {
      const recipientId = await bumpPost(tx, postId, "likeCount", 1);
      await notify(tx, { recipientId, actorId, type: "like_post", postId });
    } else {
      const [p] = await tx.select({ d: posts.deletedAt }).from(posts).where(eq(posts.id, postId));
      if (!p || p.d) throw new ServiceError("gone");
    }
  });
}

export async function unlikePost(actorId: string, postId: string) {
  await assertCanWrite(actorId);
  await db.transaction(async (tx) => {
    const removed = await tx
      .update(likes)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(likes.userId, actorId), eq(likes.postId, postId), active(likes)))
      .returning({ id: likes.id });
    if (removed.length) {
      await tx
        .update(posts)
        .set({ likeCount: sql`${posts.likeCount} - 1`, updatedAt: now })
        .where(eq(posts.id, postId));
      await unnotify(tx, { actorId, types: ["like_post"], postId });
    }
  });
}

// ---- comment likes ----
// The post author's like on someone else's comment also sets comments.author_liked_at: the
// "liked by the author" mark, which puts the comment first in the thread.

async function commentContext(tx: Tx, commentId: string) {
  const [c] = await tx
    .select({
      postId: comments.postId,
      authorId: comments.authorId,
      postAuthorId: posts.authorId,
      deletedAt: comments.deletedAt,
      postDeletedAt: posts.deletedAt,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId));
  if (!c) throw new ServiceError("not_found");
  return {
    ...c,
    byPostAuthor: (actorId: string) => actorId === c.postAuthorId && actorId !== c.authorId,
  };
}

export async function likeComment(actorId: string, commentId: string) {
  await assertCanWrite(actorId, "commentLikes");
  await db.transaction(async (tx) => {
    const c = await commentContext(tx, commentId);
    if (c.deletedAt || c.postDeletedAt) throw new ServiceError("gone");
    const inserted = await tx
      .insert(commentLikes)
      .values({ userId: actorId, commentId })
      .onConflictDoNothing({
        target: [commentLikes.userId, commentLikes.commentId],
        where: active(commentLikes),
      })
      .returning({ id: commentLikes.id });
    if (!inserted.length) return;
    await tx
      .update(comments)
      .set({
        likeCount: sql`${comments.likeCount} + 1`,
        ...(c.byPostAuthor(actorId) ? { authorLikedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(comments.id, commentId));
    await notify(tx, {
      recipientId: c.authorId,
      actorId,
      type: c.byPostAuthor(actorId) ? "author_liked" : "like_comment",
      postId: c.postId,
      commentId,
    });
  });
}

export async function unlikeComment(actorId: string, commentId: string) {
  await assertCanWrite(actorId);
  await db.transaction(async (tx) => {
    const c = await commentContext(tx, commentId);
    const removed = await tx
      .update(commentLikes)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(commentLikes.userId, actorId),
          eq(commentLikes.commentId, commentId),
          active(commentLikes),
        ),
      )
      .returning({ id: commentLikes.id });
    if (!removed.length) return;
    await tx
      .update(comments)
      .set({
        likeCount: sql`${comments.likeCount} - 1`,
        ...(c.byPostAuthor(actorId) ? { authorLikedAt: null } : {}),
        updatedAt: now,
      })
      .where(eq(comments.id, commentId));
    await unnotify(tx, { actorId, types: ["author_liked", "like_comment"], commentId });
  });
}

// ---- follows ----

export async function follow(actorId: string, followeeId: string) {
  if (actorId === followeeId) throw new ServiceError("invalid");
  await assertCanWrite(actorId, "follows");
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, followeeId), active(users)));
  if (!target) throw new ServiceError("not_found");
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(follows)
      .values({ followerId: actorId, followeeId })
      .onConflictDoNothing({
        target: [follows.followerId, follows.followeeId],
        where: active(follows),
      })
      .returning({ id: follows.id });
    if (inserted.length) await notify(tx, { recipientId: followeeId, actorId, type: "follow" });
  });
}

export async function unfollow(actorId: string, followeeId: string) {
  await assertCanWrite(actorId);
  await db.transaction(async (tx) => {
    const removed = await tx
      .update(follows)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(eq(follows.followerId, actorId), eq(follows.followeeId, followeeId), active(follows)),
      )
      .returning({ id: follows.id });
    if (removed.length) await unnotify(tx, { actorId, types: ["follow"], recipientId: followeeId });
  });
}

// ---- reads ----

const likedBy = (viewerId: string | null) =>
  viewerId
    ? sql<boolean>`exists (select 1 from ${likes} l where l.post_id = ${posts.id}
        and l.user_id = ${viewerId} and l.deleted_at is null)`
    : sql<boolean>`false`;

const postCols = (viewerId: string | null) => ({
  id: posts.id,
  authorId: posts.authorId,
  preview: posts.preview,
  hasMore: posts.hasMore,
  likeCount: posts.likeCount,
  commentCount: posts.commentCount,
  createdAt: posts.createdAt,
  editedAt: posts.editedAt,
  liked: likedBy(viewerId),
  // The author liked a comment on it: the "answered" mark (comments_author_liked_idx).
  answered: sql<boolean>`exists (select 1 from ${comments} ac where ac.post_id = ${posts.id}
    and ac.author_liked_at is not null and ac.deleted_at is null)`,
  // Authors always have a handle: posting requires finishing the welcome.
  author: { displayName: users.displayName, handle: sql<string>`${users.handle}` },
});

export type PostSummary = Awaited<ReturnType<typeof newestPage>>["items"][number];
/** `asOf`: when the first page was built; new posts after it are announced, not injected. */
export type FeedPage = { items: PostSummary[]; next: string | null; asOf: string };

const PAGE = RANKING.pageSize;
// Ops can widen/narrow the For You window without a rebuild (PLAN.md §9).
const WINDOW_DAYS = Number(process.env.FEED_WINDOW_DAYS) || RANKING.windowDays;

// The post is filed under a topic the viewer follows (the For You topic boost).
const followsTopic = (viewerId: string) =>
  sql`exists (select 1 from ${postTags} pt join ${topicFollows} tf on tf.tag = pt.tag
    where pt.post_id = ${posts.id} and pt.deleted_at is null
      and tf.user_id = ${viewerId} and tf.deleted_at is null)`;

const taggedWith = (tag: string) =>
  sql`exists (select 1 from ${postTags} pt where pt.post_id = ${posts.id}
    and pt.tag = ${tag} and pt.deleted_at is null)`;

const followsAuthor = (viewerId: string) =>
  sql`exists (select 1 from ${follows} f where f.follower_id = ${viewerId}
    and f.followee_id = ${posts.authorId} and f.deleted_at is null)`;

// Following, Latest and profiles: keyset on (created_at DESC, id DESC). The cursor carries only the
// id; its exact created_at comes from the row (soft-deleted rows stay, so the cursor never dangles).
async function newestPage(
  viewerId: string,
  filter: SQL | undefined,
  cursor: Cursor | null,
  now: Date,
) {
  const rows = await db
    .select(postCols(viewerId))
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        active(posts),
        filter,
        cursor
          ? sql`(${posts.createdAt}, ${posts.id}) <
              (select c.created_at, c.id from ${posts} c where c.id = ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PAGE + 1);
  const items = rows.slice(0, PAGE);
  const next = rows.length > PAGE ? encodeCursor({ id: items.at(-1)!.id }) : null;
  return { items, next, asOf: now.toISOString() };
}

// For You (§6.1, §6.2): the snapshot time `asOf` fixes both the age term and the candidate set.
// SQL orders by cursor_score = base * boost; the author penalty only re-sorts the returned page.
async function forYouPage(viewerId: string, cursor: Cursor | null, now: Date): Promise<FeedPage> {
  const asOf = cursor?.a ?? now.toISOString();
  const R = RANKING;
  const ageHours = sql`(extract(epoch from (${asOf}::timestamptz - ${posts.createdAt})) / 3600)::float8`;
  const score = sql<number>`((1 + ${posts.likeCount} + ${R.commentWeight}::float8 * ${posts.commentCount})
    / power(${ageHours} + ${R.ageOffsetHours}::float8, ${R.gravity}::float8)
    * (case when ${followsAuthor(viewerId)} then ${R.followBoost}::float8
            when ${followsTopic(viewerId)} then ${R.topicBoost}::float8 else 1 end))::float8`;
  const rows = await db
    .select({ ...postCols(viewerId), score })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        active(posts),
        sql`${posts.createdAt} <= ${asOf}::timestamptz`,
        sql`${posts.createdAt} > ${asOf}::timestamptz - make_interval(days => ${WINDOW_DAYS}::int)`,
        cursor?.s !== undefined
          ? sql`(${score}, ${posts.id}) < (${cursor.s}::float8, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(score), desc(posts.id))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);
  // float8 survives the JSON round trip exactly (PG prints shortest round-trip digits).
  const next =
    rows.length > PAGE && last ? encodeCursor({ a: asOf, s: last.score, id: last.id }) : null;
  return { items: applyAuthorPenalty(page), next, asOf };
}

// Top: the most liked posts of all time, keyset on (like_count DESC, id DESC) (posts_top_idx).
// Counts move while someone pages, so a post can repeat or be skipped at a page boundary; the
// client drops repeats (mergeById), and a skipped post is at most one page away from its spot.
async function topPage(
  viewerId: string,
  cursor: Cursor | null,
  now: Date,
  filter?: SQL,
): Promise<FeedPage> {
  const rows = await db
    .select(postCols(viewerId))
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        active(posts),
        filter,
        cursor?.s !== undefined
          ? sql`(${posts.likeCount}, ${posts.id}) < (${cursor.s}::int, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(posts.likeCount), desc(posts.id))
    .limit(PAGE + 1);
  const items = rows.slice(0, PAGE);
  const last = items.at(-1);
  const next = rows.length > PAGE && last ? encodeCursor({ s: last.likeCount, id: last.id }) : null;
  return { items, next, asOf: now.toISOString() };
}

export async function feedPage(
  viewerId: string,
  opts: {
    view: FeedView;
    authorId?: string;
    query?: string;
    tag?: string;
    cursor?: string | null;
    now?: Date;
  },
): Promise<FeedPage> {
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (opts.cursor && !cursor) throw new ServiceError("invalid");
  const now = opts.now ?? new Date();
  if (opts.query !== undefined) {
    // Search: newest first over the stored vector (posts_search_idx; docs/search.md).
    const q = toTsQuery(opts.query);
    if (!q) return { items: [], next: null, asOf: now.toISOString() };
    const match = sql`${posts.search} @@ to_tsquery('simple', ${q})`;
    return newestPage(viewerId, match, cursor, now);
  }
  if (opts.authorId) return newestPage(viewerId, eq(posts.authorId, opts.authorId), cursor, now);
  // A topic page: newest first, or most liked (its sort).
  if (opts.tag !== undefined) {
    const tag = normalizeTag(opts.tag);
    if (!isTag(tag)) throw new ServiceError("invalid");
    return opts.view === "top"
      ? topPage(viewerId, cursor, now, taggedWith(tag))
      : newestPage(viewerId, taggedWith(tag), cursor, now);
  }
  // Following: people you follow, and you (your new post shows at once, as on X).
  if (opts.view === "following") {
    const filter = sql`(${followsAuthor(viewerId)} or ${posts.authorId} = ${viewerId})`;
    return newestPage(viewerId, filter, cursor, now);
  }
  if (opts.view === "latest") return newestPage(viewerId, undefined, cursor, now);
  if (opts.view === "top") return topPage(viewerId, cursor, now);
  return forYouPage(viewerId, cursor, now);
}

// Posts by others published after `since` that would show in this view (the "new posts" pill).
const newSince = (viewerId: string, view: FeedView, since: Date) =>
  and(
    gt(posts.createdAt, since),
    ne(posts.authorId, viewerId),
    view === "following" ? followsAuthor(viewerId) : undefined,
  );

export async function countNewPosts(viewerId: string, view: FeedView, since: Date) {
  const [r] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(active(posts), newSince(viewerId, view, since)));
  return r.n;
}

/** The newest of those posts (one page), shown on top when the pill is clicked. */
export async function newPosts(viewerId: string, view: FeedView, since: Date) {
  return (await newestPage(viewerId, newSince(viewerId, view, since), null, new Date())).items;
}

/** The full post, including deleted ones (the page shows a "deleted" notice). */
export async function getPost(id: string, viewerId: string | null) {
  const [row] = await db
    .select({
      ...postCols(viewerId),
      body: posts.body,
      deletedAt: posts.deletedAt,
      removedAt: posts.removedAt,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, id));
  return row ?? null;
}

export async function getComment(id: string) {
  const [row] = await db.select().from(comments).where(eq(comments.id, id));
  return row ?? null;
}

export async function followInfo(userId: string, viewerId: string | null) {
  const [r] = await db.execute<{
    followers: number;
    following: number;
    viewer_follows: boolean;
  }>(sql`
    select
      (select count(*)::int from ${follows} where followee_id = ${userId} and deleted_at is null) as followers,
      (select count(*)::int from ${follows} where follower_id = ${userId} and deleted_at is null) as following,
      exists (select 1 from ${follows} where follower_id = ${viewerId} and followee_id = ${userId}
        and deleted_at is null) as viewer_follows`);
  return { followers: r.followers, following: r.following, viewerFollows: r.viewer_follows };
}

// ---- threads ----

export const THREAD_DEPTH = 5;
export const REPLIES_PAGE = 20;
export const ROOTS_PAGE = 50;

export type ThreadNode = {
  id: string;
  parentId: string | null;
  depth: number;
  deleted: boolean;
  removed: boolean; // deleted by a moderator
  body: string | null; // null when deleted
  author: { id: string; handle: string; displayName: string } | null;
  likeCount: number;
  liked: boolean; // by the viewer
  authorLiked: boolean; // by the post's author: shown with a mark, sorted first among top-level
  createdAt: Date;
  editedAt: Date | null;
  /** Visible children in the DB (live, or deleted with replies), loaded or not. */
  childCount: number;
  children: ThreadNode[];
};

/**
 * Loads children of `parentId` (null = top-level) starting at `offset`, each with its subtree
 * down to THREAD_DEPTH levels, at most REPLIES_PAGE children per comment.
 * Deleted comments without replies are hidden; deleted ones with replies become placeholders.
 * Top-level comments: the ones the post's author liked first, then most liked, then oldest.
 * Replies stay oldest first (a conversation).
 */
export async function getThread(
  postId: string,
  parentId: string | null,
  offset = 0,
  onlyId?: string,
  viewerId: string | null = null,
) {
  const byScore = !parentId && !onlyId;
  const authorLiked = (a: string) =>
    sql.raw(`(${a}.author_liked_at is not null and ${a}.deleted_at is null)`);
  const visible = sql`(x.deleted_at is null or exists (
    select 1 from comments y where y.post_id = x.post_id and y.parent_comment_id = x.id))`;
  const rows = await db.execute<{
    id: string;
    parent_comment_id: string | null;
    depth: number;
    deleted_at: string | null;
    removed_at: string | null;
    like_count: number;
    author_liked: boolean;
    liked: boolean;
    body: string;
    author_id: string;
    handle: string;
    display_name: string;
    created_at: string;
    edited_at: string | null;
    child_count: number;
  }>(sql`
    with recursive t as (
      select x.*, 1 as depth from (
        select * from comments x
        where x.post_id = ${postId}
          and ${parentId ? sql`x.parent_comment_id = ${parentId}` : sql`x.parent_comment_id is null`}
          and ${onlyId ? sql`x.id = ${onlyId}` : sql`true`}
          and ${visible}
        order by ${byScore ? sql`${authorLiked("x")} desc, x.like_count desc,` : sql``} x.created_at, x.id
        limit ${parentId ? REPLIES_PAGE : ROOTS_PAGE} offset ${offset}) x
      union all
      select c.*, t.depth + 1 from t cross join lateral (
        select * from comments x
        where x.post_id = t.post_id and x.parent_comment_id = t.id and ${visible}
        order by x.created_at, x.id
        limit ${REPLIES_PAGE}) c
      where t.depth < ${THREAD_DEPTH}
    )
    select t.id, t.parent_comment_id, t.depth, t.deleted_at, t.removed_at, t.body, t.author_id, t.created_at,
      t.edited_at, u.handle, u.display_name, t.like_count, ${authorLiked("t")} as author_liked,
      exists (select 1 from comment_likes cl where cl.comment_id = t.id
        and cl.user_id = ${viewerId} and cl.deleted_at is null) as liked,
      (select count(*)::int from comments x
        where x.post_id = t.post_id and x.parent_comment_id = t.id and ${visible}) as child_count
    from t join users u on u.id = t.author_id
    order by t.depth,
      ${byScore ? sql`case when t.depth = 1 then ${authorLiked("t")} end desc, case when t.depth = 1 then t.like_count end desc,` : sql``}
      t.created_at, t.id`);

  const byId = new Map<string, ThreadNode>();
  const roots: ThreadNode[] = [];
  for (const r of rows) {
    const deleted = r.deleted_at !== null;
    const node: ThreadNode = {
      id: r.id,
      parentId: r.parent_comment_id,
      depth: r.depth,
      deleted,
      removed: r.removed_at !== null,
      body: deleted ? null : r.body,
      author: deleted ? null : { id: r.author_id, handle: r.handle, displayName: r.display_name },
      likeCount: r.like_count,
      liked: r.liked,
      authorLiked: r.author_liked,
      createdAt: new Date(r.created_at),
      editedAt: r.edited_at ? new Date(r.edited_at) : null,
      childCount: r.child_count,
      children: [],
    };
    byId.set(node.id, node);
    (r.depth === 1 ? roots : byId.get(r.parent_comment_id!)!.children).push(node);
  }
  const [{ total }] = await db.execute<{ total: number }>(sql`
    select count(*)::int as total from comments x where x.post_id = ${postId}
      and ${parentId ? sql`x.parent_comment_id = ${parentId}` : sql`x.parent_comment_id is null`}
      and ${visible}`);
  return { nodes: roots, total };
}

// ---- users ----

/**
 * People search: handle or display-name substring (a leading @ is ignored), plus fuzzy matches
 * (pg_trgm) for typos. Exact handle first, then handle prefix, then closest, then most followed.
 */
export async function searchUsers(viewerId: string, query: string, limit = 5) {
  const q = query.trim().replace(/^@/, "").slice(0, 50);
  if (!q) return [];
  const like = q.replace(/[\\%_]/g, (c) => `\\${c}`); // user input is literal text
  const fuzzy = fuzzyText(q);
  const closeness = fuzzy
    ? sql`greatest(word_similarity(${fuzzy}, ${users.handle}), word_similarity(${fuzzy}, ${users.displayName}))`
    : sql`0::float8`; // a bare 0 in ORDER BY would mean "column 0"
  return withTrigramThreshold(FUZZY.people, (tx) =>
    tx
      .select({
        ...userCard,
        viewerFollows: sql<boolean>`exists (select 1 from ${follows} v where v.follower_id = ${viewerId}
          and v.followee_id = ${users.id} and v.deleted_at is null)`,
      })
      .from(users)
      .where(
        and(
          active(users),
          hasHandle,
          sql`(${users.handle} ilike ${"%" + like + "%"} or ${users.displayName} ilike ${"%" + like + "%"}
            ${fuzzy ? sql`or ${fuzzy} <% ${users.handle} or ${fuzzy} <% ${users.displayName}` : sql``})`,
        ),
      )
      .orderBy(
        desc(sql`${users.handle} = lower(${q})`),
        desc(sql`${users.handle} ilike ${like + "%"}`),
        desc(closeness),
        desc(sql`(select count(*) from ${follows} f where f.followee_id = ${users.id}
          and f.deleted_at is null)`),
        users.handle,
      )
      .limit(limit),
  );
}

/**
 * Typo-tolerant post search (pg_trgm), for when full-text search finds nothing: one page of the
 * closest live posts, best match first. Not paged (no stable cursor for a similarity order).
 */
export async function similarPosts(viewerId: string, query: string) {
  const fuzzy = fuzzyText(query);
  if (!fuzzy) return [];
  return withTrigramThreshold(FUZZY.posts, (tx) =>
    tx
      .select(postCols(viewerId))
      .from(posts)
      .innerJoin(users, eq(users.id, posts.authorId))
      .where(and(active(posts), sql`${fuzzy} <% ${posts.body}`))
      .orderBy(desc(sql`word_similarity(${fuzzy}, ${posts.body})`), desc(posts.createdAt))
      .limit(PAGE),
  );
}

// `a <% b` (word_similarity above the threshold) is what the trigram GIN indexes can answer; the
// threshold is a setting, so set it for this transaction only.
function withTrigramThreshold<T>(threshold: number, fn: (tx: Tx) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('pg_trgm.word_similarity_threshold', ${String(threshold)}, true)`,
    );
    return fn(tx);
  });
}

/** Whether a handle can be taken by this user ("ok" includes the user's current handle). */
export async function handleStatus(actorId: string, handle: string) {
  const h = Handle.safeParse(handle);
  if (!h.success) return "invalid" as const;
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.handle, h.data), active(users)));
  return !other || other.id === actorId ? ("ok" as const) : ("taken" as const);
}

/** Handle (unique among active users) and bio, from the welcome screen or the profile.
 * The display name is not editable: it always comes from Keycloak. */
export async function updateProfile(actorId: string, input: { handle: string; bio: string }) {
  const data = {
    handle: parse(Handle, input.handle),
    bio: parse(Bio, input.bio),
  };
  await assertCanWrite(actorId);
  if ((await handleStatus(actorId, data.handle)) === "taken") throw new ServiceError("taken");
  try {
    const [row] = await db
      .update(users)
      .set({ ...data, updatedAt: now })
      .where(and(eq(users.id, actorId), active(users)))
      .returning();
    if (!row) throw new ServiceError("not_found");
    return row;
  } catch (e) {
    // Lost a race for the same handle: the partial unique index has the last word.
    if ((e as { cause?: { code?: string } }).cause?.code === "23505")
      throw new ServiceError("taken");
    throw e;
  }
}

/** Done with the first-login welcome. Needs a handle (the one thing setup must produce). */
export async function finishOnboarding(actorId: string) {
  await assertCanWrite(actorId);
  const [u] = await db.select({ handle: users.handle }).from(users).where(eq(users.id, actorId));
  if (!u?.handle) throw new ServiceError("invalid");
  await db
    .update(users)
    .set({ onboardedAt: now, updatedAt: now })
    .where(and(eq(users.id, actorId), isNull(users.onboardedAt)));
}

// Listed people (followers, suggestions, search) all have a handle (filtered by hasHandle).
const hasHandle = isNotNull(users.handle);
const userCard = {
  id: users.id,
  handle: sql<string>`${users.handle}`,
  displayName: users.displayName,
  bio: users.bio,
};

/** Who to follow on the welcome screen: the most-followed people the viewer doesn't follow yet. */
export async function suggestedUsers(viewerId: string, limit = 5) {
  return db
    .select(userCard)
    .from(users)
    .where(
      and(
        active(users),
        hasHandle,
        ne(users.id, viewerId),
        sql`not exists (select 1 from ${follows} f where f.follower_id = ${viewerId}
          and f.followee_id = ${users.id} and f.deleted_at is null)`,
      ),
    )
    .orderBy(
      desc(sql`(select count(*) from ${follows} f where f.followee_id = ${users.id}
        and f.deleted_at is null)`),
      users.createdAt,
    )
    .limit(limit);
}

/**
 * Followers of a user, or the people they follow, newest follow first, with whether the viewer
 * follows each of them. One page (FOLLOW_PAGE); `before` is the last row's follow id.
 */
export async function followList(
  userId: string,
  viewerId: string,
  which: "followers" | "following",
  before?: string,
) {
  const f = follows;
  const [me, them] =
    which === "followers" ? [f.followeeId, f.followerId] : [f.followerId, f.followeeId];
  const rows = await db
    .select({
      ...userCard,
      followId: f.id,
      viewerFollows: sql<boolean>`exists (select 1 from ${follows} v where v.follower_id = ${viewerId}
        and v.followee_id = ${users.id} and v.deleted_at is null)`,
    })
    .from(f)
    .innerJoin(users, eq(users.id, them))
    .where(
      and(
        eq(me, userId),
        active(f),
        active(users),
        hasHandle,
        before ? sql`${f.id} < ${before}::uuid` : undefined,
      ),
    )
    .orderBy(desc(f.id)) // UUIDv7: newest follow first
    .limit(FOLLOW_PAGE + 1);
  return {
    items: rows.slice(0, FOLLOW_PAGE),
    next: rows.length > FOLLOW_PAGE ? rows[FOLLOW_PAGE - 1].followId : null,
  };
}
export const FOLLOW_PAGE = 50;

/**
 * Who liked a post or a comment, newest like first, with whether the viewer follows each of them.
 * One page (FOLLOW_PAGE); `before` is the last row's like id. Deleted posts/comments: not_found.
 */
export async function likers(
  kind: "post" | "comment",
  targetId: string,
  viewerId: string,
  before?: string,
) {
  const [target] =
    kind === "post"
      ? await db.select({ d: posts.deletedAt }).from(posts).where(eq(posts.id, targetId))
      : await db.select({ d: comments.deletedAt }).from(comments).where(eq(comments.id, targetId));
  if (!target || target.d) throw new ServiceError("not_found");
  const [l, on] =
    kind === "post"
      ? [likes, eq(likes.postId, targetId)]
      : [commentLikes, eq(commentLikes.commentId, targetId)];
  const rows = await db
    .select({
      ...userCard,
      likeId: l.id,
      viewerFollows: sql<boolean>`exists (select 1 from ${follows} v where v.follower_id = ${viewerId}
        and v.followee_id = ${users.id} and v.deleted_at is null)`,
    })
    .from(l)
    .innerJoin(users, eq(users.id, l.userId))
    .where(
      and(
        on,
        active(l),
        active(users),
        hasHandle,
        before ? sql`${l.id} < ${before}::uuid` : undefined,
      ),
    )
    .orderBy(desc(l.id)) // UUIDv7: newest like first
    .limit(FOLLOW_PAGE + 1);
  return {
    items: rows.slice(0, FOLLOW_PAGE),
    next: rows.length > FOLLOW_PAGE ? rows[FOLLOW_PAGE - 1].likeId : null,
  };
}

/**
 * Provision on first login (no handle yet: the user picks one in the mandatory welcome) and keep
 * the display name in sync with Keycloak on every login. Identity is keycloak_sub.
 */
export async function upsertUserFromClaims(c: { sub: string; displayName: string }) {
  const [existing] = await db.select().from(users).where(eq(users.keycloakSub, c.sub));
  if (existing) {
    if (existing.displayName === c.displayName) return existing;
    const [row] = await db
      .update(users)
      .set({ displayName: c.displayName, updatedAt: now })
      .where(eq(users.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(users)
    .values({ keycloakSub: c.sub, displayName: c.displayName })
    .onConflictDoNothing({ target: users.keycloakSub }) // two first logins at once
    .returning();
  return row ?? (await db.select().from(users).where(eq(users.keycloakSub, c.sub)))[0];
}

export async function getUser(id: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), active(users)));
  return u ?? null;
}

export async function getUserByHandle(handle: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.handle, handle), active(users)));
  return u ? { ...u, handle } : null; // found by handle, so it has one
}

/** Seeded and other users for the dev login switcher. */
export async function listUsers(limit = 50) {
  return db
    .select({
      id: users.id,
      handle: users.handle,
      displayName: users.displayName,
    })
    .from(users)
    .where(active(users))
    .orderBy(users.createdAt)
    .limit(limit);
}

// ---- moderation (docs/moderation.md) ----
// The actor must be an active admin. Each action changes its target and writes its audit row in
// one transaction; a no-op (already removed, already suspended) writes nothing.

export async function isAdmin(userId: string) {
  const [r] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(and(eq(admins.userId, userId), active(admins)));
  return !!r;
}

type LogEntry = {
  action: ModerationAction;
  postId?: string;
  commentId?: string;
  userId?: string;
  detail?: string;
};

async function moderate(
  actorId: string,
  reason: string,
  fn: (tx: Tx, log: (e: LogEntry) => Promise<string>) => Promise<void>,
) {
  const why = parse(Reason, reason);
  await db.transaction(async (tx) => {
    const [admin] = await tx
      .select({ id: admins.id })
      .from(admins)
      .innerJoin(users, eq(users.id, admins.userId))
      .where(and(eq(admins.userId, actorId), active(admins), active(users)));
    if (!admin) throw new ServiceError("forbidden");
    await fn(tx, async (e) => {
      const [row] = await tx
        .insert(moderationActions)
        .values({ ...e, actorId, reason: why })
        .returning({ id: moderationActions.id });
      return row.id;
    });
  });
}

// Why an update matched nothing: no such row, or it is already in the other state.
async function missing(tx: Tx, table: typeof posts | typeof comments | typeof users, id: string) {
  const [row] = await tx
    .select({ id: table.id })
    .from(table as typeof posts)
    .where(eq(table.id, id));
  return new ServiceError(row ? "gone" : "not_found");
}

export async function removePost(actorId: string, postId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const rows = await tx
      .update(posts)
      .set({ deletedAt: now, removedAt: now, updatedAt: now })
      .where(and(eq(posts.id, postId), active(posts)))
      .returning({ authorId: posts.authorId });
    if (!rows.length) throw await missing(tx, posts, postId);
    const moderationActionId = await log({ action: "remove_post", postId });
    await notify(tx, {
      recipientId: rows[0].authorId,
      actorId,
      type: "removed_post",
      postId,
      moderationActionId,
    });
  });
}

/** Undo a moderator removal (an author's own delete stays deleted). */
export async function restorePost(actorId: string, postId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const rows = await tx
      .update(posts)
      .set({ deletedAt: null, removedAt: null, updatedAt: now })
      .where(and(eq(posts.id, postId), isNotNull(posts.removedAt)))
      .returning({ authorId: posts.authorId });
    if (!rows.length) throw await missing(tx, posts, postId);
    const moderationActionId = await log({ action: "restore_post", postId });
    await notify(tx, {
      recipientId: rows[0].authorId,
      actorId,
      type: "restored_post",
      postId,
      moderationActionId,
    });
  });
}

// Counters as in deleteComment: only this comment leaves post.comment_count; restoring adds it back.
export async function removeComment(actorId: string, commentId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const [row] = await tx
      .update(comments)
      .set({ deletedAt: now, removedAt: now, updatedAt: now })
      .where(and(eq(comments.id, commentId), active(comments)))
      .returning({ postId: comments.postId, authorId: comments.authorId });
    if (!row) throw await missing(tx, comments, commentId);
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} - 1`, updatedAt: now })
      .where(eq(posts.id, row.postId));
    const moderationActionId = await log({ action: "remove_comment", commentId });
    await notify(tx, {
      recipientId: row.authorId,
      actorId,
      type: "removed_comment",
      postId: row.postId,
      commentId,
      moderationActionId,
    });
  });
}

export async function restoreComment(actorId: string, commentId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const [row] = await tx
      .update(comments)
      .set({ deletedAt: null, removedAt: null, updatedAt: now })
      .where(and(eq(comments.id, commentId), isNotNull(comments.removedAt)))
      .returning({ postId: comments.postId, authorId: comments.authorId });
    if (!row) throw await missing(tx, comments, commentId);
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1`, updatedAt: now })
      .where(eq(posts.id, row.postId));
    const moderationActionId = await log({ action: "restore_comment", commentId });
    await notify(tx, {
      recipientId: row.authorId,
      actorId,
      type: "restored_comment",
      postId: row.postId,
      commentId,
      moderationActionId,
    });
  });
}

async function targetUser(tx: Tx, actorId: string, userId: string) {
  if (userId === actorId) throw new ServiceError("invalid"); // never yourself
  const [u] = await tx
    .select()
    .from(users)
    .where(and(eq(users.id, userId), active(users)));
  if (!u) throw new ServiceError("not_found");
  return u;
}

/** Locks the user out of Z (requireLogin sends them to /suspended). Not for admins. */
export async function suspendUser(actorId: string, userId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const u = await targetUser(tx, actorId, userId);
    if (u.suspendedAt) return;
    const [admin] = await tx
      .select({ id: admins.id })
      .from(admins)
      .where(and(eq(admins.userId, userId), active(admins)));
    if (admin) throw new ServiceError("forbidden"); // revoke admin first
    await tx.update(users).set({ suspendedAt: now, updatedAt: now }).where(eq(users.id, userId));
    await log({ action: "suspend_user", userId });
  });
}

export async function unsuspendUser(actorId: string, userId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const u = await targetUser(tx, actorId, userId);
    if (!u.suspendedAt) return;
    await tx.update(users).set({ suspendedAt: null, updatedAt: now }).where(eq(users.id, userId));
    await log({ action: "unsuspend_user", userId });
  });
}

export async function clearBio(actorId: string, userId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const u = await targetUser(tx, actorId, userId);
    if (!u.bio) return;
    await tx.update(users).set({ bio: "", updatedAt: now }).where(eq(users.id, userId));
    await log({ action: "clear_bio", userId, detail: u.bio });
  });
}

/**
 * Replaces the handle with a neutral placeholder and sends the user back through the welcome to
 * pick a new one. (Not null: their posts and comments keep linking to a profile meanwhile.)
 */
export async function resetHandle(actorId: string, userId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const u = await targetUser(tx, actorId, userId);
    if (!u.handle) return;
    const placeholder = `u_${randomBytes(5).toString("hex")}`; // matches HANDLE_RE
    await tx
      .update(users)
      .set({ handle: placeholder, onboardedAt: null, updatedAt: now })
      .where(eq(users.id, userId));
    await log({ action: "reset_handle", userId, detail: u.handle });
  });
}

export async function grantAdmin(actorId: string, handle: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    const [u] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, handle.trim().replace(/^@/, "").toLowerCase()), active(users)));
    if (!u) throw new ServiceError("not_found");
    if (u.id !== actorId) await targetUser(tx, actorId, u.id); // same checks as other targets
    const inserted = await tx
      .insert(admins)
      .values({ userId: u.id, grantedBy: actorId })
      .onConflictDoNothing({ target: admins.userId, where: active(admins) })
      .returning({ id: admins.id });
    if (inserted.length) await log({ action: "grant_admin", userId: u.id });
  });
}

/** Admins can revoke each other but not themselves, so there is always at least one. */
export async function revokeAdmin(actorId: string, userId: string, reason: string) {
  await moderate(actorId, reason, async (tx, log) => {
    if (userId === actorId) throw new ServiceError("invalid");
    const rows = await tx
      .update(admins)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(admins.userId, userId), active(admins)))
      .returning({ id: admins.id });
    if (rows.length) await log({ action: "revoke_admin", userId });
  });
}

export async function listAdmins() {
  return db
    .select({
      id: users.id,
      handle: sql<string>`${users.handle}`,
      displayName: users.displayName,
      since: admins.createdAt,
    })
    .from(admins)
    .innerJoin(users, eq(users.id, admins.userId))
    .where(and(active(admins), active(users)))
    .orderBy(admins.createdAt);
}

export async function suspendedUsers() {
  return db
    .select({
      id: users.id,
      handle: sql<string>`${users.handle}`,
      displayName: users.displayName,
      since: users.suspendedAt,
    })
    .from(users)
    .where(and(isNotNull(users.suspendedAt), active(users)))
    .orderBy(desc(users.suspendedAt));
}

export const LOG_PAGE = 100;

/** The newest audit entries, with enough of each target to show and link it. */
export async function moderationLog(limit = LOG_PAGE) {
  const actor = alias(users, "actor");
  const target = alias(users, "target");
  return db
    .select({
      id: moderationActions.id,
      at: moderationActions.createdAt,
      action: moderationActions.action,
      reason: moderationActions.reason,
      detail: moderationActions.detail,
      actor: { handle: actor.handle, displayName: actor.displayName },
      post: { id: posts.id, preview: posts.preview, removedAt: posts.removedAt },
      comment: {
        id: comments.id,
        postId: comments.postId,
        body: comments.body,
        removedAt: comments.removedAt,
      },
      user: { id: target.id, handle: target.handle, displayName: target.displayName },
    })
    .from(moderationActions)
    .leftJoin(actor, eq(actor.id, moderationActions.actorId))
    .leftJoin(posts, eq(posts.id, moderationActions.postId))
    .leftJoin(comments, eq(comments.id, moderationActions.commentId))
    .leftJoin(target, eq(target.id, moderationActions.userId))
    .orderBy(desc(moderationActions.createdAt), desc(moderationActions.id))
    .limit(limit);
}

// ---- notifications: reads (docs/notifications.md) ----

// Shown only while their post/comment is live: deleting a comment hides the notifications about
// it, restoring brings them back. Moderation notices always show: they are about the removal.
const shownNotification = sql`(n.type like 'removed\_%' or n.type like 'restored\_%' or (
  (n.post_id is null or exists (select 1 from posts p where p.id = n.post_id and p.deleted_at is null))
  and (n.comment_id is null
    or exists (select 1 from comments c where c.id = n.comment_id and c.deleted_at is null))))`;

/** Unread count for the bell, capped at UNREAD_CAP (the badge shows "99+"), so the poll stays
 * cheap however much someone has left unread. */
export async function unreadNotifications(userId: string) {
  const [r] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from (select 1 from notifications n
      where n.recipient_id = ${userId} and n.read_at is null and n.deleted_at is null
        and ${shownNotification}
      limit ${UNREAD_CAP}) x`);
  return r.n;
}
export const UNREAD_CAP = 100;

export const NOTIFICATIONS_PAGE = 100;

export type NotificationRow = {
  id: string;
  type: NotificationType;
  createdAt: Date;
  unread: boolean;
  postId: string | null;
  commentId: string | null;
  actor: { handle: string; displayName: string } | null;
  postPreview: string | null;
  commentBody: string | null;
  reason: string | null; // moderation notices
};

/** Newest first; `before` is the last row's id. Marks nothing read (markNotificationsRead). */
export async function notificationsPage(userId: string, before?: string) {
  const rows = await db.execute<{
    id: string;
    type: NotificationType;
    created_at: string;
    read_at: string | null;
    post_id: string | null;
    comment_id: string | null;
    actor_handle: string | null;
    actor_name: string | null;
    post_preview: string | null;
    comment_body: string | null;
    reason: string | null;
  }>(sql`
    select n.id, n.type, n.created_at, n.read_at, n.post_id, n.comment_id,
      a.handle as actor_handle, a.display_name as actor_name,
      p.preview as post_preview, c.body as comment_body, m.reason
    from notifications n
      left join users a on a.id = n.actor_id
      left join posts p on p.id = n.post_id
      left join comments c on c.id = n.comment_id
      left join moderation_actions m on m.id = n.moderation_action_id
    where n.recipient_id = ${userId} and n.deleted_at is null and ${shownNotification}
      ${
        before
          ? sql`and (n.created_at, n.id) <
              (select b.created_at, b.id from notifications b where b.id = ${before}::uuid)`
          : sql``
      }
    order by n.created_at desc, n.id desc
    limit ${NOTIFICATIONS_PAGE + 1}`);
  const items: NotificationRow[] = rows.slice(0, NOTIFICATIONS_PAGE).map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: new Date(r.created_at),
    unread: r.read_at === null,
    postId: r.post_id,
    commentId: r.comment_id,
    actor: r.actor_handle ? { handle: r.actor_handle, displayName: r.actor_name! } : null,
    postPreview: r.post_preview,
    commentBody: r.comment_body,
    reason: r.reason,
  }));
  return { items, next: rows.length > NOTIFICATIONS_PAGE ? items.at(-1)!.id : null };
}

/** Marks the user's notifications read, up to and including `upTo` (what they have seen). */
export async function markNotificationsRead(userId: string, upTo: string) {
  await assertCanWrite(userId);
  await db.execute(sql`
    update notifications set read_at = now(), updated_at = now()
    where recipient_id = ${userId} and read_at is null and deleted_at is null
      and (created_at, id) <= (select u.created_at, u.id from notifications u
        where u.id = ${upTo}::uuid and u.recipient_id = ${userId})`);
}

// ---- topics (docs/topics.md) ----

const Tag = (t: string) => {
  const tag = normalizeTag(String(t));
  if (!isTag(tag)) throw new ServiceError("invalid");
  return tag;
};

// Live posts under a topic (deleted or removed posts don't count).
const liveTagged = and(
  active(postTags),
  sql`exists (select 1 from ${posts} p where p.id = ${postTags.postId} and p.deleted_at is null)`,
);

/** A topic page's header: how many posts, and whether the viewer follows it. */
export async function topicInfo(viewerId: string, tagInput: string) {
  const tag = Tag(tagInput);
  const [{ posts: count }] = await db
    .select({ posts: sql<number>`count(*)::int` })
    .from(postTags)
    .where(and(eq(postTags.tag, tag), liveTagged));
  const [follow] = await db
    .select({ id: topicFollows.id })
    .from(topicFollows)
    .where(and(eq(topicFollows.userId, viewerId), eq(topicFollows.tag, tag), active(topicFollows)));
  return { tag, posts: count, following: !!follow };
}

export async function followTopic(actorId: string, tagInput: string) {
  const tag = Tag(tagInput);
  await assertCanWrite(actorId);
  await db
    .insert(topicFollows)
    .values({ userId: actorId, tag })
    .onConflictDoNothing({
      target: [topicFollows.userId, topicFollows.tag],
      where: active(topicFollows),
    });
}

export async function unfollowTopic(actorId: string, tagInput: string) {
  const tag = Tag(tagInput);
  await assertCanWrite(actorId);
  await db
    .update(topicFollows)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(topicFollows.userId, actorId), eq(topicFollows.tag, tag), active(topicFollows)));
}

/** The topics a user follows, alphabetical, with their live post counts. */
export async function followedTopics(viewerId: string) {
  return db
    .select({ tag: topicFollows.tag, posts: sql<number>`count(${posts.id})::int` })
    .from(topicFollows)
    .leftJoin(postTags, and(eq(postTags.tag, topicFollows.tag), active(postTags)))
    .leftJoin(posts, and(eq(posts.id, postTags.postId), active(posts)))
    .where(and(eq(topicFollows.userId, viewerId), active(topicFollows)))
    .groupBy(topicFollows.tag)
    .orderBy(topicFollows.tag);
}

/** The most used topics in the last `days` (the sidebar), by live posts. */
export async function popularTopics(days = 7, limit = 8) {
  return db
    .select({ tag: postTags.tag, posts: sql<number>`count(*)::int` })
    .from(postTags)
    .where(
      and(liveTagged, sql`${postTags.createdAt} > now() - make_interval(days => ${days}::int)`),
    )
    .groupBy(postTags.tag)
    .orderBy(desc(sql`count(*)`), postTags.tag)
    .limit(limit);
}

/** Topics starting with `prefix`, most used first (the composer's # autocomplete). */
export async function topicSuggestions(prefix: string, limit = 5) {
  const p = normalizeTag(prefix);
  if (!p) return [];
  const like = p.replace(/[\\%_]/g, (c) => `\\${c}`) + "%";
  return db
    .select({ tag: postTags.tag, posts: sql<number>`count(*)::int` })
    .from(postTags)
    .where(and(liveTagged, sql`${postTags.tag} like ${like}`))
    .groupBy(postTags.tag)
    .orderBy(desc(sql`count(*)`), postTags.tag)
    .limit(limit);
}

// ---- pinned post (one per profile) ----

/** Pin one of your own live posts to the top of your profile (replaces the previous pin). */
export async function pinPost(actorId: string, postId: string) {
  await assertCanWrite(actorId);
  await ownActive(posts, postId, actorId);
  await db.update(users).set({ pinnedPostId: postId, updatedAt: now }).where(eq(users.id, actorId));
}

export async function unpinPost(actorId: string) {
  await assertCanWrite(actorId);
  await db.update(users).set({ pinnedPostId: null, updatedAt: now }).where(eq(users.id, actorId));
}

/** The card of a user's pinned post, if it's still live. */
export async function pinnedPost(viewerId: string, userId: string) {
  const [row] = await db
    .select(postCols(viewerId))
    .from(users)
    .innerJoin(posts, eq(posts.id, users.pinnedPostId))
    .where(and(eq(users.id, userId), active(posts)));
  return row ?? null;
}
