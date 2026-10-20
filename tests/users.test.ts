import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { sql } from "@/db/client";
import * as s from "@/lib/services";
import { upsertUserFromClaims } from "@/lib/services";
import { makeUser } from "./helpers";
import { BIO_MAX } from "@/lib/limits";

afterAll(() => sql.end());

const tag = () => randomUUID().slice(0, 8);

test("first login provisions without a handle; later logins resync only the display name", async () => {
  const sub = randomUUID();
  const u1 = await upsertUserFromClaims({ sub, displayName: "שם ישן" });
  expect(u1).toMatchObject({ handle: null, onboardedAt: null, displayName: "שם ישן" });
  const u2 = await upsertUserFromClaims({ sub, displayName: "שם חדש" });
  expect(u2.id).toBe(u1.id);
  expect(u2.displayName).toBe("שם חדש");
});

test("the welcome can't be finished without a handle", async () => {
  const u = await upsertUserFromClaims({ sub: randomUUID(), displayName: "חדש" });
  await expect(s.finishOnboarding(u.id)).rejects.toThrow("invalid");
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
    for (const bad of ["ab", "1abc", "_abc", "has space", "שלום", "a".repeat(16), "dot.ted"]) {
      expect(await s.handleStatus(b.id, bad)).toBe("invalid");
      await expect(s.updateProfile(b.id, profile(bad))).rejects.toThrow("invalid");
    }
  });

  test("handle and the name stay separate: Keycloak updates the name, never the handle", async () => {
    const sub = randomUUID();
    const u = await upsertUserFromClaims({ sub, displayName: "מקלוק" });
    const mine = h();
    await s.updateProfile(u.id, profile(mine));
    await s.finishOnboarding(u.id);
    const again = await upsertUserFromClaims({ sub, displayName: "שם חדש" });
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

describe("people search", () => {
  test("handle or name substring (with or without @), exact handle first, literal input", async () => {
    const t = tag()
      .replace(/[^a-z]/g, "q")
      .slice(0, 6);
    const viewer = await makeUser();
    const exact = await makeUser("אחד", `p${t}`);
    const longer = await makeUser("שניים", `p${t}x`);
    const byName = await makeUser(`רונית ${t}ית`, `n${t}`);
    await upsertUserFromClaims({ sub: randomUUID(), displayName: `${t}ית בלי כינוי` }); // not listed
    const ids = async (q: string) => (await s.searchUsers(viewer.id, q, 10)).map((u) => u.id);

    // exact handle, then handle prefix, then the close (fuzzy) `n...` handle
    expect(await ids(`p${t}`)).toEqual([exact.id, longer.id, byName.id]);
    expect(await ids(`@P${t}`)).toEqual([exact.id, longer.id, byName.id]); // @ and case ignored
    expect((await ids(`${t}ית`))[0]).toBe(byName.id); // inside the display name: closest first
    expect((await ids(t)).sort()).toEqual([exact.id, longer.id, byName.id].sort()); // inside handles and names
    expect(await ids("______")).toEqual([]); // _ is a character, not a wildcard
    expect(await ids("   ")).toEqual([]);
  });

  test("fuzzy (pg_trgm): finds a name or handle despite a typo", async () => {
    const t = tag()
      .replace(/[^a-z]/g, "q")
      .slice(0, 6);
    const viewer = await makeUser();
    const u = await makeUser(`שרון ${t}berg`, `s${t}`);
    const ids = async (q: string) => (await s.searchUsers(viewer.id, q, 10)).map((x) => x.id);
    expect(await ids(`${t}brg`)).toEqual([u.id]); // typo in the name
    expect(await ids(`s${t.slice(0, 5)}x`)).toEqual([u.id]); // typo in the handle
  });
});
