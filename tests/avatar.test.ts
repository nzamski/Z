// Generated avatars (lib/avatar.ts): stable per seed, mirrored, and saved only in the stored format.
import { randomUUID } from "node:crypto";
import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import { AVATAR_SEED_RE, avatarPattern, newAvatarSeed } from "@/lib/avatar";
import * as s from "@/lib/services";
import { upsertUserFromClaims } from "@/lib/services";

afterAll(() => sql.end());

test("a seed always draws the same mirrored pattern; other seeds draw others", () => {
  const a = avatarPattern("1a2b3c4d");
  expect(avatarPattern("1a2b3c4d")).toEqual(a);
  expect(a.hue).toBeGreaterThanOrEqual(0);
  expect(a.hue).toBeLessThan(360);
  const on = new Set(a.cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of a.cells) {
    expect(x >= 0 && x < 5 && y >= 0 && y < 5).toBe(true);
    expect(on.has(`${4 - x},${y}`)).toBe(true);
  }
  const seeds = Array.from({ length: 50 }, newAvatarSeed);
  expect(seeds.every((x) => AVATAR_SEED_RE.test(x))).toBe(true);
  const drawn = new Set(seeds.map((x) => JSON.stringify(avatarPattern(x))));
  expect(drawn.size).toBeGreaterThan(45);
});

test("new users get a seed; the profile saves a shuffled one and refuses anything else", async () => {
  const u = await upsertUserFromClaims({ sub: randomUUID(), displayName: "אווטאר" });
  expect(u.avatarSeed).toMatch(AVATAR_SEED_RE);
  const handle = `av_${randomUUID().slice(0, 8)}`;
  const seed = newAvatarSeed();
  expect((await s.updateProfile(u.id, { handle, bio: "", avatarSeed: seed })).avatarSeed).toBe(
    seed,
  );
  for (const bad of ["", "<svg>", "x".repeat(17)])
    await expect(s.updateProfile(u.id, { handle, bio: "", avatarSeed: bad })).rejects.toThrow(
      "invalid",
    );
  // Left out (forms that don't send it): unchanged.
  expect((await s.updateProfile(u.id, { handle, bio: "x" })).avatarSeed).toBe(seed);
});
