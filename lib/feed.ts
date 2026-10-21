// Feed ranking config and pure helpers (PLAN.md §6). No DB access: the client imports this too.
// The constants are untested starting guesses; see docs/ranking.md.
import { z } from "zod";

export const RANKING = {
  pageSize: 20,
  windowDays: 30, // For You candidates: posts from the last N days of the snapshot
  commentWeight: 0.5,
  ageOffsetHours: 2,
  gravity: 1.5,
  followBoost: 2.0,
  topicBoost: 1.5, // posts under a topic you follow (docs/topics.md)
  authorPenalty: 0.7, // nth post by one author within a page is scaled by 0.7^(n-1)
  restoreMaxAgeMinutes: 30, // sessionStorage scroll snapshot
  newPostsPollSeconds: 15, // For You / Following check for posts newer than the snapshot; the bell polls too
} as const;

// Orders a feed can have: the home tabs, plus newest-first (profiles, search, topics) and most
// liked (a topic page's sort).
export const FEED_VIEWS = ["forYou", "following", "latest", "top"] as const;
export type FeedView = (typeof FEED_VIEWS)[number];
// The home page's tabs (and its remembered choice): For You and Following.
export const FEED_TABS = ["forYou", "following"] as const satisfies readonly FeedView[];
export type FeedTab = (typeof FEED_TABS)[number];
export const parseTab = (v: unknown): FeedTab =>
  FEED_TABS.includes(v as FeedTab) ? (v as FeedTab) : "forYou";
export const VIEW_COOKIE = "z_view"; // last chosen tab; not in the URL
export const PILL_SLOT = "new-posts-pill"; // home: the row above the composer that holds the pill
export const parseView = (v: unknown): FeedView =>
  FEED_VIEWS.includes(v as FeedView) ? (v as FeedView) : "forYou";

/**
 * Opaque page cursor. For You: snapshot time `a`, last score `s`, last id. Top: last like count
 * `s` and id. Other keyset views: last id only (the query looks up its exact created_at, so no
 * JS Date precision is lost).
 */
const Cursor = z.object({ a: z.iso.datetime().optional(), s: z.number().optional(), id: z.uuid() });
export type Cursor = z.infer<typeof Cursor>;

export const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");

export function decodeCursor(raw: string): Cursor | null {
  try {
    const r = Cursor.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Page-local author penalty: re-orders within the page only, never drops posts (§6.2). */
export function applyAuthorPenalty<T extends { authorId: string; score: number }>(page: T[]) {
  const seen = new Map<string, number>();
  return page
    .map((p, i) => {
      const n = seen.get(p.authorId) ?? 0;
      seen.set(p.authorId, n + 1);
      return { p, i, display: p.score * RANKING.authorPenalty ** n };
    })
    .sort((x, y) => y.display - x.display || x.i - y.i)
    .map((x) => x.p);
}

/** Append pages without duplicates: scores move between requests (§6.1). First occurrence wins. */
export function mergeById<T extends { id: string }>(a: T[], b: T[]) {
  const ids = new Set(a.map((x) => x.id));
  return [...a, ...b.filter((x) => !ids.has(x.id))];
}
