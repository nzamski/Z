// PLAN.md §5. Table names are plural because `user` and `like` are reserved words in SQL.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

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
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarSeed: text("avatar_seed").notNull().default(""),
  },
  (t) => [
    uniqueIndex("users_keycloak_sub_uq").on(t.keycloakSub),
    uniqueIndex("users_handle_active_uq")
      .on(t.handle)
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
  },
  (t) => [
    // Plain `ORDER BY ... DESC` is NULLS FIRST; drizzle's .desc() alone emits NULLS LAST, which
    // the planner won't use for that order.
    index("posts_feed_idx")
      .on(t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.deletedAt} is null`),
    index("posts_author_idx")
      .on(t.authorId, t.createdAt.desc().nullsFirst(), t.id.desc().nullsFirst())
      .where(sql`${t.deletedAt} is null`),
    index("posts_updated_at_idx").on(t.updatedAt),
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
  },
  (t) => [
    index("comments_thread_idx").on(t.postId, t.parentCommentId, t.createdAt),
    index("comments_updated_at_idx").on(t.updatedAt),
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
  ],
);
