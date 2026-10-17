// PLAN.md §6.1 required tests, with a fixed clock. Each test seeds posts in its own past year,
// so posts other test files create at now() are never candidates.
import { afterAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { posts } from "@/db/schema";
import { applyAuthorPenalty, mergeById, RANKING } from "@/lib/feed";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const HOUR = 3_600_000;

async function seed(year: number, n: number, authors: { id: string }[]) {
  const asOf = new Date(Date.UTC(year, 5, 30));
  const rows = await db
    .insert(posts)
    .values(
      Array.from({ length: n }, (_, i) => ({
        authorId: authors[i % authors.length].id,
        body: `p${i}`,
        preview: `p${i}`,
        hasMore: false,
        likeCount: (i * 7) % 5,
        commentCount: (i * 3) % 4,
        // Some share a timestamp, some fall outside the 30-day window.
        createdAt: new Date(asOf.getTime() - Math.floor(i / 2) * 9 * HOUR - 1),
      })),
    )
    .returning();
  return { asOf, rows };
}

async function pageAll(viewerId: string, now: Date, between?: () => Promise<unknown>) {
  const pages = [];
  let cursor: string | null = null;
  do {
    const p = await s.feedPage(viewerId, { view: "forYou", cursor, now });
    pages.push(p.items);
    cursor = p.next;
    if (between) await between();
  } while (cursor);
  return pages;
}

const inWindow = <T extends { createdAt: Date }>(rows: T[], asOf: Date) =>
  rows.filter((r) => r.createdAt.getTime() > asOf.getTime() - RANKING.windowDays * 24 * HOUR);

describe("For You snapshot cursor", () => {
  test("(a) no writes: paging yields every candidate exactly once, in score order", async () => {
    const [viewer, a, b, c] = [
      await makeUser(),
      await makeUser(),
      await makeUser(),
      await makeUser(),
    ];
    await s.follow(viewer.id, b.id);
    const { asOf, rows } = await seed(2001, 95, [a, b, c]);
    const pages = await pageAll(viewer.id, asOf);
    const ids = pages.flat().map((p) => p.id);
    expect(pages.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(inWindow(rows, asOf).map((r) => r.id)));

    // Across pages, scores never increase (the penalty only re-sorts inside a page).
    const maxes = pages.map((p) =>
      Math.max(...p.map((x) => (x as unknown as { score: number }).score)),
    );
    const mins = pages.map((p) =>
      Math.min(...p.map((x) => (x as unknown as { score: number }).score)),
    );
    for (let i = 1; i < pages.length; i++) expect(maxes[i]).toBeLessThanOrEqual(mins[i - 1]);
  });

  test("(b) likes and comments between pages: the merged list has no duplicates", async () => {
    const [viewer, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    const { asOf, rows } = await seed(2002, 80, [a, b]);
    const live = inWindow(rows, asOf);
    let k = 0;
    const pages = await pageAll(viewer.id, asOf, async () => {
      // Bump posts near the boundary and deep in the list so their scores jump between pages.
      for (const r of [live[(k * 13) % live.length], live[(k * 29 + 5) % live.length]]) {
        await s.likePost(viewer.id, r.id).catch(() => {});
        await s.createComment(viewer.id, r.id, "תגובה");
      }
      k++;
    });
    const merged = pages.reduce<{ id: string }[]>((acc, p) => mergeById(acc, p), []);
    expect(new Set(merged.map((p) => p.id)).size).toBe(merged.length);
  });

  test("(c) posts created after feed_as_of never appear in that snapshot", async () => {
    const [viewer, a] = [await makeUser(), await makeUser()];
    const { asOf } = await seed(2003, 50, [a]);
    const late: string[] = [];
    const pages = await pageAll(viewer.id, asOf, async () => {
      const [p] = await db
        .insert(posts)
        .values({
          authorId: a.id,
          body: "late",
          preview: "late",
          hasMore: false,
          likeCount: 1000, // would rank first if it leaked in
          createdAt: new Date(asOf.getTime() + 1000),
        })
        .returning();
      late.push(p.id);
    });
    const ids = new Set(pages.flat().map((p) => p.id));
    expect(late.length).toBeGreaterThan(0);
    for (const id of late) expect(ids.has(id)).toBe(false);
  });

  test("score matches the §6.2 formula, including the follow boost", async () => {
    const [viewer, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    await s.follow(viewer.id, b.id);
    const { asOf, rows } = await seed(2004, 6, [a, b]);
    const [page] = await pageAll(viewer.id, asOf);
    for (const p of page as unknown as { id: string; authorId: string; score: number }[]) {
      const r = rows.find((x) => x.id === p.id)!;
      const age = (asOf.getTime() - r.createdAt.getTime()) / HOUR;
      const base = (1 + r.likeCount + 0.5 * r.commentCount) / (age + 2) ** 1.5;
      expect(p.score).toBeCloseTo(base * (r.authorId === b.id ? 2 : 1), 12);
    }
  });

  test("rejects a garbled cursor", async () => {
    const viewer = await makeUser();
    await expect(s.feedPage(viewer.id, { view: "forYou", cursor: "nope" })).rejects.toThrow(
      "invalid",
    );
  });
});

describe("keyset views", () => {
  test("Latest and Following page through without gaps or repeats", async () => {
    const [viewer, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    await s.follow(viewer.id, a.id);
    const { rows } = await seed(2005, 45, [a, b]); // pairs share created_at: id breaks the tie
    for (const view of ["latest", "following"] as const) {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const p = await s.feedPage(viewer.id, { view, cursor });
        seen.push(...p.items.map((x) => x.id));
        cursor = p.next;
      } while (cursor);
      expect(new Set(seen).size).toBe(seen.length);
      const mine = rows
        .filter((r) => view === "latest" || r.authorId === a.id)
        .sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime() || (y.id > x.id ? 1 : -1))
        .map((r) => r.id);
      expect(seen.filter((id) => mine.includes(id))).toEqual(mine);
    }
  });
});

describe("author penalty", () => {
  test("re-sorts within the page by score * 0.7^(n-1) and keeps every post", () => {
    const page = [
      { id: "1", authorId: "x", score: 10 },
      { id: "2", authorId: "x", score: 9 }, // 6.3
      { id: "3", authorId: "y", score: 7 },
      { id: "4", authorId: "x", score: 8 }, // 3.92
    ];
    expect(applyAuthorPenalty(page).map((p) => p.id)).toEqual(["1", "3", "2", "4"]);
  });
});

describe("new posts pill", () => {
  test("counts others' posts after the snapshot, filtered by view", async () => {
    const [viewer, followed, other] = [await makeUser(), await makeUser(), await makeUser()];
    await s.follow(viewer.id, followed.id);
    const since = new Date();
    await new Promise((r) => setTimeout(r, 5));
    await s.createPost(followed.id, "חדש");
    await s.createPost(other.id, "חדש");
    await s.createPost(viewer.id, "שלי"); // own posts are never announced
    const following = await s.countNewPosts(viewer.id, "following", since);
    expect(following).toBe(1);
    // For You counts everyone's (other test files may add more concurrently).
    expect(await s.countNewPosts(viewer.id, "forYou", since)).toBeGreaterThanOrEqual(2);
  });
});

describe("search", () => {
  test("Hebrew prefixes match both ways, terms are ANDed, deleted posts never show", async () => {
    const [viewer, a] = [await makeUser(), await makeUser()];
    const tag = `zq${Math.random().toString(36).slice(2, 8)}`; // keeps other tests' posts out
    const p1 = await s.createPost(a.id, `השרת קרס בלילה ${tag}`);
    const p2 = await s.createPost(a.id, `שרת חדש עלה ${tag}`);
    const p3 = await s.createPost(a.id, `ובמערכת הכול שקט ${tag}`);
    const gone = await s.createPost(a.id, `השרת הישן ${tag}`);
    await s.deletePost(a.id, gone.id);
    const ids = async (query: string) =>
      (await s.feedPage(viewer.id, { view: "latest", query })).items.map((x) => x.id).sort();

    expect(await ids(`שרת ${tag}`)).toEqual([p1.id, p2.id].sort());
    expect(await ids(`השרת ${tag}`)).toEqual([p1.id, p2.id].sort());
    expect(await ids(`מערכת ${tag}`)).toEqual([p3.id]); // two prefixes (ו+ב) on the post
    expect(await ids(`קר ${tag}`)).toEqual([p1.id]); // word prefix
    expect(await ids(`שרת שקט ${tag}`)).toEqual([]); // AND
    expect(await ids(`!!!`)).toEqual([]);
  });
});
