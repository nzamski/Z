import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { db, sql } from "@/db/client";
import { admins, dailyVisits, reports } from "@/db/schema";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: s.ServiceError) => e.code,
  );
const reportsOn = (col: "postId" | "commentId", id: string) =>
  db.select().from(reports).where(eq(reports[col], id));
const reported = async (id: string) => (await s.openReports()).find((r) => r.postId === id);
const inbox = async (userId: string) =>
  (await s.notificationsPage(userId)).items.map((n) => [n.type, n.actor?.handle ?? null]);

let admin: Awaited<ReturnType<typeof makeUser>>;
beforeAll(async () => {
  admin = await makeUser("מנהלת");
  await db.insert(admins).values({ userId: admin.id });
});

describe("reporting", () => {
  test("report a post: once per person while open; not your own; admins notified once", async () => {
    const [author, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    const p = await s.createPost(author.id, "פוסט בעייתי");
    await s.reportContent(a.id, { postId: p.id }, { reason: "spam", note: " פרסומת " });
    await s.reportContent(a.id, { postId: p.id }, { reason: "abuse" }); // already open: nothing
    await s.reportContent(b.id, { postId: p.id }, { reason: "abuse" });
    expect((await reportsOn("postId", p.id)).length).toBe(2);
    expect(await code(s.reportContent(author.id, { postId: p.id }, { reason: "spam" }))).toBe(
      "invalid",
    );

    const item = (await reported(p.id))!;
    expect(item).toMatchObject({ commentId: null, text: "פוסט בעייתי", count: 2 });
    expect(item.author.handle).toBe(author.handle);
    expect(item.reports.map((r) => [r.reason, r.note, r.by.handle])).toEqual([
      ["abuse", "", b.handle],
      ["spam", "פרסומת", a.handle],
    ]);
    // One notification per item (the first report), to each admin; never to the author.
    expect((await inbox(admin.id)).filter(([t]) => t === "report")).toContainEqual([
      "report",
      a.handle,
    ]);
    expect((await inbox(admin.id)).filter(([t, h]) => t === "report" && h === b.handle)).toEqual(
      [],
    );
    expect((await inbox(author.id)).map(([t]) => t)).not.toContain("report");
  });

  test("bad input and missing or deleted targets", async () => {
    const [author, a] = [await makeUser(), await makeUser()];
    const p = await s.createPost(author.id, "פוסט");
    expect(await code(s.reportContent(a.id, { postId: p.id }, { reason: "boring" }))).toBe(
      "invalid",
    );
    expect(
      await code(
        s.reportContent(a.id, { postId: p.id }, { reason: "other", note: "x".repeat(301) }),
      ),
    ).toBe("invalid");
    expect(
      await code(s.reportContent(a.id, { postId: crypto.randomUUID() }, { reason: "spam" })),
    ).toBe("not_found");
    await s.deletePost(author.id, p.id);
    expect(await code(s.reportContent(a.id, { postId: p.id }, { reason: "spam" }))).toBe("gone");
  });

  test("removing the item closes its reports; the author deleting it drops it from the queue", async () => {
    const [author, a] = [await makeUser(), await makeUser()];
    const p = await s.createPost(author.id, "פוסט");
    const c = await s.createComment(author.id, p.id, "תגובה פוגענית");
    await s.reportContent(a.id, { commentId: c.id }, { reason: "abuse" });
    const item = (await s.openReports()).find((r) => r.commentId === c.id)!;
    expect(item).toMatchObject({ postId: p.id, text: "תגובה פוגענית" });

    await s.removeComment(admin.id, c.id, "פוגעני");
    const [r] = await reportsOn("commentId", c.id);
    expect(r).toMatchObject({ resolution: "removed", resolvedBy: admin.id });
    expect(r.moderationActionId).not.toBeNull();
    expect((await s.openReports()).find((x) => x.commentId === c.id)).toBeUndefined();

    const p2 = await s.createPost(author.id, "עוד פוסט");
    await s.reportContent(a.id, { postId: p2.id }, { reason: "spam" });
    const before = await s.openReportCount();
    await s.deletePost(author.id, p2.id);
    expect(await reported(p2.id)).toBeUndefined();
    expect(await s.openReportCount()).toBe(before - 1);
  });

  test("dismiss: admins only, with a reason, logged; reporting again later opens a new one", async () => {
    const [author, a] = [await makeUser(), await makeUser()];
    const p = await s.createPost(author.id, "פוסט תקין");
    await s.reportContent(a.id, { postId: p.id }, { reason: "misleading" });
    expect(await code(s.dismissReports(a.id, { postId: p.id }, "לא"))).toBe("forbidden");
    expect(await code(s.dismissReports(admin.id, { postId: p.id }, " "))).toBe("invalid");
    await s.dismissReports(admin.id, { postId: p.id }, "תקין");
    expect(await reported(p.id)).toBeUndefined();
    expect((await reportsOn("postId", p.id))[0].resolution).toBe("dismissed");
    expect(await code(s.dismissReports(admin.id, { postId: p.id }, "שוב"))).toBe("not_found");
    // This post's entry: other test files write to the log in parallel, so the newest may be theirs.
    const log = (await s.moderationLog()).find((l) => l.post?.id === p.id);
    expect(log).toMatchObject({ action: "dismiss_reports", reason: "תקין" });

    await s.reportContent(a.id, { postId: p.id }, { reason: "misleading" });
    expect((await reported(p.id))!.count).toBe(1);
  });

  test("suspended users can't report", async () => {
    const [author, a] = [await makeUser(), await makeUser()];
    const p = await s.createPost(author.id, "פוסט");
    await sql`update users set suspended_at = now() where id = ${a.id}`;
    expect(await code(s.reportContent(a.id, { postId: p.id }, { reason: "spam" }))).toBe(
      "suspended",
    );
  });
});

describe("visits", () => {
  test("one row per user per day, in the stats time zone", async () => {
    const u = await makeUser();
    // 23:30 UTC on Oct 21 is already Oct 22 in Israel.
    await s.recordVisit(u.id, new Date("2026-10-21T23:30:00Z"));
    await s.recordVisit(u.id, new Date("2026-10-22T08:00:00Z"));
    await s.recordVisit(u.id, new Date("2026-10-23T08:00:00Z"));
    const days = (await db.select().from(dailyVisits).where(eq(dailyVisits.userId, u.id)))
      .map((v) => v.day)
      .sort();
    expect(days).toEqual(["2026-10-22", "2026-10-23"]);
  });
});
