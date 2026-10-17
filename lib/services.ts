// Service layer: every write goes through here (PLAN.md §3, §5). All deletes are soft.
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db/client";
import { comments, follows, likes, posts, users } from "@/db/schema";
import { computePreview } from "@/lib/markdown";

export class ServiceError extends Error {
  constructor(public code: "invalid" | "not_found" | "forbidden" | "gone") {
    super(code);
  }
}

const PostBody = z.string().trim().min(1).max(20_000);
const CommentBody = z.string().trim().min(1).max(5_000);
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

// Placeholder feed until M3: newest live posts with their author.
export async function latestPosts(limit = 20) {
  return db
    .select({
      id: posts.id,
      preview: posts.preview,
      hasMore: posts.hasMore,
      likeCount: posts.likeCount,
      commentCount: posts.commentCount,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      author: { displayName: users.displayName, handle: users.handle, unit: users.unit },
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(active(posts))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit);
}
