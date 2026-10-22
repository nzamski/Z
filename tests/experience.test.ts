// Experience on profiles (lib/experience.ts, docs/experience.md).
import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import { duration, EXPERIENCE_MAX, months } from "@/lib/experience";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

test("role length counts both months; Hebrew durations", () => {
  const today = new Date("2026-10-22T12:00:00Z");
  expect(months("2026-01", "2026-03")).toBe(3);
  expect(months("2026-10", null, today)).toBe(1);
  expect(months("2024-08", null, today)).toBe(27);
  expect(duration(1)).toBe("חודש");
  expect(duration(2)).toBe("חודשיים");
  expect(duration(12)).toBe("שנה");
  expect(duration(14)).toBe("שנה וחודשיים");
  expect(duration(27)).toBe("שנתיים ו-3 חודשים");
  expect(duration(60)).toBe("5 שנים");
});

const role = (o: Partial<Parameters<typeof s.saveExperience>[1]> = {}) => ({
  title: "מפתח/ת",
  organization: "צוות הדמיה",
  start: "2022-01",
  end: "2023-06" as string | null,
  description: "",
  ...o,
});

test("roles: current first, then newest; only the owner edits or deletes", async () => {
  const [a, b] = [await makeUser(), await makeUser()];
  const old = await s.saveExperience(a.id, role({ title: "ישן" }));
  const now = await s.saveExperience(a.id, role({ title: "נוכחי", start: "2023-07", end: null }));
  await s.saveExperience(a.id, role({ title: "אמצע", start: "2023-01", end: "2023-06" }));
  expect((await s.experienceOf(a.id)).map((r) => r.title)).toEqual(["נוכחי", "אמצע", "ישן"]);

  await s.saveExperience(a.id, { ...role({ title: "ישן יותר" }), id: old.id });
  expect((await s.experienceOf(a.id)).at(-1)).toMatchObject({
    title: "ישן יותר",
    startMonth: "2022-01-01",
    endMonth: "2023-06-01",
  });
  // Someone else's role: as if it weren't there.
  await expect(s.saveExperience(b.id, { ...role(), id: now.id })).rejects.toThrow("not_found");
  await expect(s.deleteExperience(b.id, now.id)).rejects.toThrow("not_found");

  await s.deleteExperience(a.id, now.id);
  expect((await s.experienceOf(a.id)).map((r) => r.title)).toEqual(["אמצע", "ישן יותר"]);
});

test("roles need a title and a sane range; at most EXPERIENCE_MAX each", async () => {
  const u = await makeUser();
  for (const bad of [
    role({ title: "  " }),
    role({ start: "2999-01", end: null }), // starts in the future
    role({ start: "2023-05", end: "2023-04" }), // ends before it starts
    role({ start: "2023-13" }),
    role({ description: "x".repeat(501) }),
  ])
    await expect(s.saveExperience(u.id, bad), JSON.stringify(bad)).rejects.toThrow("invalid");

  for (let i = 0; i < EXPERIENCE_MAX; i++) await s.saveExperience(u.id, role());
  await expect(s.saveExperience(u.id, role())).rejects.toThrow("experience_limit");
});
