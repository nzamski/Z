// Service layer: every write goes through here (PLAN.md §3, §5). All deletes are soft.
import { and, count, desc, eq, gt, isNull, ne, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import { comments, follows, likes, posts, users } from "@/db/schema";
import {
  applyAuthorPenalty,
  decodeCursor,
  encodeCursor,
  RANKING,
  type Cursor,
  type FeedView,
} from "@/lib/feed";
import { BIO_MAX, COMMENT_MAX, POST_MAX } from "@/lib/limits";
import { computePreview } from "@/lib/preview";

export class ServiceError extends Error {
  constructor(public code: "invalid" | "not_found" | "forbidden" | "gone") {
    super(code);
  }
}

const PostBody = z.string().trim().min(1).max(POST_MAX);
const CommentBody = z.string().trim().min(1).max(COMMENT_MAX);
const Bio = z.string().trim().max(BIO_MAX);
const now = sql`now()`;
const active = (t: { deletedAt: AnyPgColumn }) => isNull(t.deletedAt);

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new ServiceError("invalid");
  return r.data;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Bumps a counter on an active post; throws `gone` if the post is deleted, rolling back the transaction.
async function bumpPost(tx: Tx, postId: string, col: "likeCount" | "commentCount", by: 1 | -1) {
  const c = posts[col];
  const rows = await tx
    .update(posts)
    .set({ [col]: sql`${c} + ${by}`, updatedAt: now })
    .where(and(eq(posts.id, postId), active(posts)))
    .returning({ id: posts.id });
  if (!rows.length) throw new ServiceError("gone");
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

// ---- posts ----

export async function createPost(actorId: string, body: string) {
  const text = parse(PostBody, body);
  const [row] = await db
    .insert(posts)
    .values({ authorId: actorId, body: text, ...computePreview(text) })
    .returning();
  return row;
}

export async function editPost(actorId: string, postId: string, body: string) {
  const text = parse(PostBody, body);
  await ownActive(posts, postId, actorId);
  const [row] = await db
    .update(posts)
    .set({ body: text, ...computePreview(text), editedAt: now, updatedAt: now })
    .where(eq(posts.id, postId))
    .returning();
  return row;
}

export async function deletePost(actorId: string, postId: string) {
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
  return db.transaction(async (tx) => {
    if (parentCommentId) {
      const [parent] = await tx
        .select({ postId: comments.postId, deletedAt: comments.deletedAt })
        .from(comments)
        .where(eq(comments.id, parentCommentId));
      if (!parent || parent.postId !== postId) throw new ServiceError("not_found");
      if (parent.deletedAt) throw new ServiceError("gone");
    }
    await bumpPost(tx, postId, "commentCount", 1);
    const [row] = await tx
      .insert(comments)
      .values({ postId, authorId: actorId, parentCommentId, body: text })
      .returning();
    return row;
  });
}

export async function editComment(actorId: string, commentId: string, body: string) {
  const text = parse(CommentBody, body);
  await ownActive(comments, commentId, actorId);
  const [row] = await db
    .update(comments)
    .set({ body: text, editedAt: now, updatedAt: now })
    .where(eq(comments.id, commentId))
    .returning();
  return row;
}

// Replies keep counting toward post.comment_count; only this comment is subtracted.
export async function deleteComment(actorId: string, commentId: string) {
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
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(likes)
      .values({ userId: actorId, postId })
      .onConflictDoNothing({ target: [likes.userId, likes.postId], where: active(likes) })
      .returning({ id: likes.id });
    if (inserted.length) await bumpPost(tx, postId, "likeCount", 1);
    else {
      const [p] = await tx.select({ d: posts.deletedAt }).from(posts).where(eq(posts.id, postId));
      if (!p || p.d) throw new ServiceError("gone");
    }
  });
}

export async function unlikePost(actorId: string, postId: string) {
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
    }
  });
}

// ---- follows ----

export async function follow(actorId: string, followeeId: string) {
  if (actorId === followeeId) throw new ServiceError("invalid");
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, followeeId), active(users)));
  if (!target) throw new ServiceError("not_found");
  await db
    .insert(follows)
    .values({ followerId: actorId, followeeId })
    .onConflictDoNothing({
      target: [follows.followerId, follows.followeeId],
      where: active(follows),
    });
}

export async function unfollow(actorId: string, followeeId: string) {
  await db
    .update(follows)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(eq(follows.followerId, actorId), eq(follows.followeeId, followeeId), active(follows)),
    );
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
  author: { displayName: users.displayName, handle: users.handle },
});

export type PostSummary = Awaited<ReturnType<typeof newestPage>>["items"][number];
/** `asOf`: when the first page was built; new posts after it are announced, not injected. */
export type FeedPage = { items: PostSummary[]; next: string | null; asOf: string };

const PAGE = RANKING.pageSize;

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
    * (case when ${followsAuthor(viewerId)} then ${R.followBoost}::float8 else 1 end))::float8`;
  const rows = await db
    .select({ ...postCols(viewerId), score })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(
      and(
        active(posts),
        sql`${posts.createdAt} <= ${asOf}::timestamptz`,
        sql`${posts.createdAt} > ${asOf}::timestamptz - make_interval(days => ${R.windowDays}::int)`,
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

export async function feedPage(
  viewerId: string,
  opts: { view: FeedView; authorId?: string; cursor?: string | null; now?: Date },
): Promise<FeedPage> {
  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null;
  if (opts.cursor && !cursor) throw new ServiceError("invalid");
  const now = opts.now ?? new Date();
  if (opts.authorId) return newestPage(viewerId, eq(posts.authorId, opts.authorId), cursor, now);
  if (opts.view === "following") return newestPage(viewerId, followsAuthor(viewerId), cursor, now);
  if (opts.view === "latest") return newestPage(viewerId, undefined, cursor, now);
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
    .select({ ...postCols(viewerId), body: posts.body, deletedAt: posts.deletedAt })
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
  body: string | null; // null when deleted
  author: { id: string; handle: string; displayName: string } | null;
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
 */
export async function getThread(
  postId: string,
  parentId: string | null,
  offset = 0,
  onlyId?: string,
) {
  const visible = sql`(x.deleted_at is null or exists (
    select 1 from comments y where y.post_id = x.post_id and y.parent_comment_id = x.id))`;
  const rows = await db.execute<{
    id: string;
    parent_comment_id: string | null;
    depth: number;
    deleted_at: string | null;
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
        order by x.created_at, x.id
        limit ${parentId ? REPLIES_PAGE : ROOTS_PAGE} offset ${offset}) x
      union all
      select c.*, t.depth + 1 from t cross join lateral (
        select * from comments x
        where x.post_id = t.post_id and x.parent_comment_id = t.id and ${visible}
        order by x.created_at, x.id
        limit ${REPLIES_PAGE}) c
      where t.depth < ${THREAD_DEPTH}
    )
    select t.id, t.parent_comment_id, t.depth, t.deleted_at, t.body, t.author_id, t.created_at,
      t.edited_at, u.handle, u.display_name,
      (select count(*)::int from comments x
        where x.post_id = t.post_id and x.parent_comment_id = t.id and ${visible}) as child_count
    from t join users u on u.id = t.author_id
    order by t.depth, t.created_at, t.id`);

  const byId = new Map<string, ThreadNode>();
  const roots: ThreadNode[] = [];
  for (const r of rows) {
    const deleted = r.deleted_at !== null;
    const node: ThreadNode = {
      id: r.id,
      parentId: r.parent_comment_id,
      depth: r.depth,
      deleted,
      body: deleted ? null : r.body,
      author: deleted ? null : { id: r.author_id, handle: r.handle, displayName: r.display_name },
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

export async function updateBio(actorId: string, bio: string) {
  const text = parse(Bio, bio);
  await db.update(users).set({ bio: text, updatedAt: now }).where(eq(users.id, actorId));
}

/**
 * Provision on first login, resync display name and handle on every login (PLAN.md §5).
 * Identity is keycloak_sub; a handle taken by another active user is never stolen.
 */
export async function upsertUserFromClaims(c: {
  sub: string;
  handle: string;
  displayName: string;
}) {
  return db.transaction(async (tx) => {
    const [taken] = await tx
      .select({ id: users.id, sub: users.keycloakSub })
      .from(users)
      .where(and(eq(users.handle, c.handle), active(users)));
    const handleFree = !taken || taken.sub === c.sub;

    const [existing] = await tx.select().from(users).where(eq(users.keycloakSub, c.sub));
    if (existing) {
      if (!handleFree) {
        console.warn(
          `handle "${c.handle}" for sub ${c.sub} is taken; keeping "${existing.handle}"`,
        );
      }
      const [row] = await tx
        .update(users)
        .set({
          displayName: c.displayName,
          handle: handleFree ? c.handle : existing.handle,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id))
        .returning();
      return row;
    }
    // New user whose handle is taken: suffix with part of the sub so it stays unique.
    const handle = handleFree ? c.handle : `${c.handle}_${c.sub.replace(/-/g, "").slice(0, 6)}`;
    if (!handleFree)
      console.warn(`handle "${c.handle}" is taken; provisioning sub ${c.sub} as "${handle}"`);
    const [row] = await tx
      .insert(users)
      .values({ keycloakSub: c.sub, handle, displayName: c.displayName })
      .returning();
    return row;
  });
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
  return u ?? null;
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
