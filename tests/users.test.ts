import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test, vi } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { upsertUserFromClaims } from "@/lib/services";
import { makeUser } from "./helpers";
import { BIO_MAX } from "@/lib/limits";

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

describe("profile", () => {
  const h = () => `h_${tag()}`;
  const profile = (handle: string, bio = "") => ({ handle, bio });

  test("updates handle (lowercased) and bio; bio can be cleared and is capped", async () => {
    const u = await makeUser();
    const handle = h();
    const r = await s.updateProfile(u.id, profile(handle.toUpperCase(), "  שלום  "));
    expect(r).toMatchObject({ displayName: u.displayName, handle, bio: "שלום" });
    expect((await s.updateProfile(u.id, profile(handle))).bio).toBe("");
    await expect(s.updateProfile(u.id, profile(handle, "א".repeat(BIO_MAX + 1)))).rejects.toThrow(
      "invalid",
    );
  });

  test("a handle taken by another active user is refused; bad formats too", async () => {
    const [a, b] = [await makeUser(), await makeUser()];
    expect(await s.handleStatus(b.id, a.handle)).toBe("taken");
    expect(await s.handleStatus(a.id, a.handle)).toBe("ok"); // your own
    await expect(s.updateProfile(b.id, profile(a.handle))).rejects.toThrow("taken");
    for (const bad of ["abc", "1abc", "_abc", "has space", "שלום", "a".repeat(16), "dot.ted"]) {
      expect(await s.handleStatus(b.id, bad)).toBe("invalid");
      await expect(s.updateProfile(b.id, profile(bad))).rejects.toThrow("invalid");
    }
  });

  test("after the welcome Keycloak keeps the name in sync but no longer touches the handle", async () => {
    const sub = randomUUID();
    const kc = `kc_${tag()}`;
    const u = await upsertUserFromClaims({ sub, handle: kc, displayName: "מקלוק" });
    expect(u.onboardedAt).toBeNull(); // new users get the welcome
    const mine = h();
    await s.updateProfile(u.id, profile(mine));
    await s.finishOnboarding(u.id);
    const again = await upsertUserFromClaims({ sub, handle: kc, displayName: "שם חדש" });
    expect(again).toMatchObject({ handle: mine, displayName: "שם חדש" });
    expect(again.onboardedAt).not.toBeNull();
  });
});

describe("follow lists and suggestions", () => {
  test("followers / following, newest first, with whether the viewer follows each", async () => {
    const [u, a, b, viewer] = [
      await makeUser(),
      await makeUser(),
      await makeUser(),
      await makeUser(),
    ];
    await s.follow(a.id, u.id);
    await s.follow(b.id, u.id);
    await s.follow(u.id, a.id);
    await s.follow(viewer.id, b.id);
    await s.unfollow(b.id, u.id);
    await s.follow(b.id, u.id); // re-follow: newest
    const followers = await s.followList(u.id, viewer.id, "followers");
    expect(followers.items.map((x) => [x.id, x.viewerFollows])).toEqual([
      [b.id, true],
      [a.id, false],
    ]);
    expect((await s.followList(u.id, viewer.id, "following")).items.map((x) => x.id)).toEqual([
      a.id,
    ]);
  });

  test("suggestions skip yourself and people you already follow", async () => {
    const [viewer, a] = [await makeUser(), await makeUser()];
    await s.follow(viewer.id, a.id);
    const ids = (await s.suggestedUsers(viewer.id, 100)).map((x) => x.id);
    expect(ids).not.toContain(viewer.id);
    expect(ids).not.toContain(a.id);
  });
});
