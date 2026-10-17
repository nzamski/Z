import { randomUUID } from "node:crypto";
import { afterAll, expect, test, vi } from "vitest";
import { sql } from "@/db/client";
import { upsertUserFromClaims } from "@/lib/services";

afterAll(() => sql.end());

const tag = () => randomUUID().slice(0, 8);

test("first login provisions; later logins resync handle and display name", async () => {
  const sub = randomUUID();
  const h = `h_${tag()}`;
  const u1 = await upsertUserFromClaims({ sub, handle: h, displayName: "שם ישן" });
  const h2 = `h_${tag()}`;
  const u2 = await upsertUserFromClaims({ sub, handle: h2, displayName: "שם חדש" });
  expect(u2.id).toBe(u1.id);
  expect(u2).toMatchObject({ handle: h2, displayName: "שם חדש" });
});

test("a handle taken by another active user is not stolen on resync", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const taken = `h_${tag()}`;
  await upsertUserFromClaims({ sub: randomUUID(), handle: taken, displayName: "בעלים" });
  const sub = randomUUID();
  const mine = `h_${tag()}`;
  await upsertUserFromClaims({ sub, handle: mine, displayName: "אני" });

  const after = await upsertUserFromClaims({ sub, handle: taken, displayName: "אני" });
  expect(after.handle).toBe(mine);
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("a new user whose handle is taken gets a unique suffixed handle", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const taken = `h_${tag()}`;
  await upsertUserFromClaims({ sub: randomUUID(), handle: taken, displayName: "בעלים" });
  const u = await upsertUserFromClaims({ sub: randomUUID(), handle: taken, displayName: "חדש" });
  expect(u.handle).not.toBe(taken);
  expect(u.handle.startsWith(`${taken}_`)).toBe(true);
  warn.mockRestore();
});
