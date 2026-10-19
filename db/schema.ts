// PLAN.md §5. Table names are plural because `user` and `like` are reserved words in SQL.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// Every table: UUIDv7 id (DB default, see drizzle/0000_functions.sql) and the sync columns.
const base = {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuid_generate_v7()`),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
};

export const users = pgTable(
  "users",
  {
    ...base,
    keycloakSub: text("keycloak_sub").notNull(),
    // Chosen by the user in the first-login welcome (never taken from Keycloak); null until then.
    handle: text("handle"),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarSeed: text("avatar_seed").notNull().default(""),
    // Set when the user finishes the (mandatory) first-login welcome; until then the user can
    // only reach /welcome.
    onboardedAt: ts("onboarded_at"),
    // Set by a moderator: the user can still read, but not post, comment, like or follow.
    suspendedAt: ts("suspended_at"),
  },
  (t) => [
    uniqueIndex("users_keycloak_sub_uq").on(t.keycloakSub),
    uniqueIndex("users_handle_active_uq")
      .on(t.handle)
      .where(sql`${t.deletedAt} is null`),
    // pg_trgm (drizzle/0009_trgm.sql): substring and fuzzy people search.
    index("users_handle_trgm_idx")
      .using("gin", t.handle.op("gin_trgm_ops"))
      .where(sql`${t.deletedAt} is null`),
    index("users_display_name_trgm_idx")
      .using("gin", t.displayName.op("gin_trgm_ops"))
      .where(sql`${t.deletedAt} is null`),
    index("users_updated_at_idx").on(t.updatedAt),
  ],
);

export const posts = pgTable(
  "posts",
  {
    ...base,
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    preview: text("preview").notNull(),
    hasMore: boolean("has_more").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    editedAt: ts("edited_at"),
    // Removed by a moderator (deleted_at is set too); null for the author's own delete.
    removedAt: ts("removed_at"),
    // Search vector kept in sync by Postgres (z_search_vector: drizzle/0005_search.sql).
    search: tsvector("search").generatedAlwaysAs(sql`z_search_vector(body)`),
  },
  (t) => [
    index("posts_search_idx")
      .using("gin", t.search)
      .where(sql`${t.deletedAt} is null`),
    // pg_trgm: typo-tolerant fallback when full-text search finds nothing (docs/search.md).
    index("posts_body_trgm_idx")
      .using("gin", t.body.op("gin_trgm_ops"))
      .where(sql`${t.deletedAt} is null`),
    // Plain `ORDER BY ... DESC` is NULLS FIRST; drizzle's .desc() alone emits NULLS LAST, which
    // the planner won't use for that order.
    index("posts_feed_idx")
      .on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.deletedAt} is null`),
    index("posts_author_idx")
      .on(t.authorId, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.deletedAt} is null`),
    index("posts_updated_at_idx").on(t.updatedAt),
    // Rate limits count recent rows per author, deleted ones included (RATE, lib/limits.ts).
    index("posts_rate_idx").on(t.authorId, t.createdAt),
  ],
);

export const comments = pgTable(
  "comments",
  {
    ...base,
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => comments.id),
    body: text("body").notNull(),
    editedAt: ts("edited_at"),
    // Removed by a moderator (deleted_at is set too); null for the author's own delete.
    removedAt: ts("removed_at"),
    likeCount: integer("like_count").notNull().default(0),
    // When the post's author liked this comment (their "this answered it" mark); null otherwise.
    // Kept in step by likeComment/unlikeComment, like like_count.
    authorLikedAt: ts("author_liked_at"),
  },
  (t) => [
    // Posts with an author-liked comment (the "answered" mark on cards).
    index("comments_author_liked_idx")
      .on(t.postId)
      .where(sql`${t.authorLikedAt} is not null and ${t.deletedAt} is null`),
    index("comments_thread_idx").on(t.postId, t.parentCommentId, t.createdAt),
    index("comments_updated_at_idx").on(t.updatedAt),
    index("comments_rate_idx").on(t.authorId, t.createdAt),
  ],
);

export const likes = pgTable(
  "likes",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id),
  },
  (t) => [
    uniqueIndex("likes_active_uq")
      .on(t.userId, t.postId)
      .where(sql`${t.deletedAt} is null`),
    index("likes_post_idx")
      .on(t.postId)
      .where(sql`${t.deletedAt} is null`),
    index("likes_updated_at_idx").on(t.updatedAt),
    index("likes_rate_idx").on(t.userId, t.createdAt),
  ],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id),
  },
  (t) => [
    uniqueIndex("comment_likes_active_uq")
      .on(t.userId, t.commentId)
      .where(sql`${t.deletedAt} is null`),
    index("comment_likes_rate_idx").on(t.userId, t.createdAt),
    index("comment_likes_updated_at_idx").on(t.updatedAt),
  ],
);

export const follows = pgTable(
  "follows",
  {
    ...base,
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id),
    followeeId: uuid("followee_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    uniqueIndex("follows_active_uq")
      .on(t.followerId, t.followeeId)
      .where(sql`${t.deletedAt} is null`),
    index("follows_follower_idx")
      .on(t.followerId)
      .where(sql`${t.deletedAt} is null`),
    check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`),
    index("follows_updated_at_idx").on(t.updatedAt),
    index("follows_rate_idx").on(t.followerId, t.createdAt),
  ],
);

// Who may moderate. Revoking soft-deletes the row; one active row per user.
export const admins = pgTable(
  "admins",
  {
    ...base,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // Null: granted from the command line (scripts/admin.mjs).
    grantedBy: uuid("granted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("admins_user_active_uq")
      .on(t.userId)
      .where(sql`${t.deletedAt} is null`),
    index("admins_updated_at_idx").on(t.updatedAt),
  ],
);

export const MODERATION_ACTIONS = [
  "remove_post",
  "restore_post",
  "remove_comment",
  "restore_comment",
  "suspend_user",
  "unsuspend_user",
  "clear_bio",
  "reset_handle",
  "grant_admin",
  "revoke_admin",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

// Audit log of every moderation action. Append-only: rows are never edited or deleted.
export const moderationActions = pgTable(
  "moderation_actions",
  {
    ...base,
    // Null: done from the command line (scripts/admin.mjs).
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").$type<ModerationAction>().notNull(),
    // Exactly one target.
    postId: uuid("post_id").references(() => posts.id),
    commentId: uuid("comment_id").references(() => comments.id),
    userId: uuid("user_id").references(() => users.id),
    reason: text("reason").notNull(),
    // What was changed, for the record (the old bio or handle).
    detail: text("detail"),
  },
  (t) => [
    check(
      "moderation_actions_action_ck",
      sql.raw(`action in (${MODERATION_ACTIONS.map((a) => `'${a}'`).join(", ")})`),
    ),
    check(
      "moderation_actions_one_target_ck",
      sql`num_nonnulls(${t.postId}, ${t.commentId}, ${t.userId}) = 1`,
    ),
    index("moderation_actions_log_idx").on(t.createdAt.desc().nullsFirst()),
    index("moderation_actions_updated_at_idx").on(t.updatedAt),
  ],
);
