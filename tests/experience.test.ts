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
  unit: "צוות הדמיה",
  location: "בסיס הדמיה",
  start: "2022-01",
  end: "2023-06" as string | null,
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
    location: "בסיס הדמיה",
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
  ])
    await expect(s.saveExperience(u.id, bad), JSON.stringify(bad)).rejects.toThrow("invalid");

  for (let i = 0; i < EXPERIENCE_MAX; i++) await s.saveExperience(u.id, role());
  await expect(s.saveExperience(u.id, role())).rejects.toThrow("experience_limit");
});

test("people search matches role titles and units, and shows the role that matched", async () => {
  const tag = Math.random().toString(36).slice(2, 8);
  const tag2 = Math.random().toString(36).slice(2, 8); // unrelated, so fuzzy matching can't mix them
  const [a, b, viewer] = [await makeUser(), await makeUser(), await makeUser()];
  await s.saveExperience(a.id, role({ title: `מהנדס/ת נתונים ${tag}`, unit: "ענף א" }));
  await s.saveExperience(a.id, role({ title: "ראש צוות", start: "2023-07", end: null }));
  await s.saveExperience(b.id, role({ title: "ראש צוות", unit: `מדור ${tag2}`, end: null }));

  const byTitle = await s.searchUsers(viewer.id, `נתונים ${tag}`);
  expect(byTitle.map((u) => u.id)).toEqual([a.id]);
  // The past role that matched, not the current one.
  expect(byTitle[0].role).toEqual({
    title: `מהנדס/ת נתונים ${tag}`,
    unit: "ענף א",
    current: false,
  });

  const byUnit = await s.searchUsers(viewer.id, `מדור ${tag2}`);
  expect(byUnit.map((u) => u.id)).toEqual([b.id]);
  expect(byUnit[0].role).toMatchObject({ unit: `מדור ${tag2}`, current: true });

  // A deleted role no longer matches.
  const [r] = await s.experienceOf(b.id);
  await s.deleteExperience(b.id, r.id);
  expect(await s.searchUsers(viewer.id, `מדור ${tag2}`)).toEqual([]);
});

test("peopleInUnit: exact unit ignoring case and spaces, current people first", async () => {
  const unit = `Unit ${Math.random().toString(36).slice(2, 8)}`;
  const [left, here, other, viewer] = [
    await makeUser(),
    await makeUser(),
    await makeUser(),
    await makeUser(),
  ];
  await s.saveExperience(left.id, role({ unit, end: "2024-01" }));
  await s.saveExperience(here.id, role({ unit: unit.toLowerCase(), end: null }));
  await s.saveExperience(other.id, role({ unit: `${unit} ב` })); // a different unit
  const people = await s.peopleInUnit(viewer.id, `  ${unit.toUpperCase()} `);
  expect(people.map((u) => u.id)).toEqual([here.id, left.id]);
  expect(people[0].role).toMatchObject({ current: true });
  expect(people[1].role).toMatchObject({ current: false });
  expect(await s.peopleInUnit(viewer.id, "%")).toEqual([]); // wildcards are literal
});

test("experienceSuggestions: units in use containing the text, prefix first, then most used", async () => {
  const tag = Math.random().toString(36).slice(2, 8);
  const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];
  await s.saveExperience(a.id, role({ unit: `ענף ${tag}` }));
  await s.saveExperience(b.id, role({ unit: `מדור ${tag}` }));
  await s.saveExperience(c.id, role({ unit: `מדור ${tag}` }));
  const gone = await s.saveExperience(c.id, role({ unit: `${tag} ישן`, start: "2020-01" }));
  await s.deleteExperience(c.id, gone.id);
  expect(await s.experienceSuggestions("unit", tag)).toEqual([`מדור ${tag}`, `ענף ${tag}`]);
  expect(await s.experienceSuggestions("unit", `ענף ${tag}`)).toEqual([`ענף ${tag}`]);
  expect(await s.experienceSuggestions("unit", "  ")).toEqual([]);
});
