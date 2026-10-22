// Service details on profiles (lib/service-info.ts): the checks, and what updateServiceInfo keeps.
import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import { daysUntil, isServiceEnd, isServiceStart, serviceDays } from "@/lib/service-info";
import * as s from "@/lib/services";
import { makeUser } from "./helpers";

afterAll(() => sql.end());

const today = new Date("2026-10-22T15:00:00Z");

test("days in service count whole days; start dates are real, past and plausible", () => {
  expect(serviceDays("2026-10-22", today)).toBe(0);
  expect(serviceDays("2025-10-22", today)).toBe(365);
  expect(isServiceStart("2024-02-29", today)).toBe(true);
  for (const bad of ["2026-10-23", "2026-02-30", "1950-01-01", "22/10/2026", ""])
    expect(isServiceStart(bad, today), bad).toBe(false);
});

test("days left to the release; end dates may be past or ahead, within limits", () => {
  expect(daysUntil("2026-10-23", today)).toBe(1);
  expect(daysUntil("2026-10-21", today)).toBe(-1);
  expect(isServiceEnd("2028-07-01", today)).toBe(true);
  expect(isServiceEnd("2020-01-01", today)).toBe(true);
  for (const bad of ["2080-01-01", "2026-13-01", ""])
    expect(isServiceEnd(bad, today), bad).toBe(false);
});

test("service details save on their own, clear with blanks, and refuse bad values", async () => {
  const u = await makeUser();
  const saved = await s.updateServiceInfo(u.id, {
    rank: "captain",
    serviceType: "career",
    serviceArm: "air",
    serviceStart: "2020-03-01",
    serviceEnd: "2030-03-01",
  });
  expect(saved).toMatchObject({
    rank: "captain",
    serviceType: "career",
    serviceArm: "air",
    serviceStart: "2020-03-01",
    serviceEnd: "2030-03-01",
  });
  // Edit profile (handle, bio...) leaves them alone, and so does a save that doesn't send one.
  await s.updateProfile(u.id, { handle: u.handle!, bio: "x" });
  expect(await s.updateServiceInfo(u.id, { rank: "major" })).toMatchObject({
    rank: "major",
    serviceArm: "air",
  });
  for (const bad of [
    { rank: "general" },
    { serviceType: "volunteer" },
    { serviceArm: "space" },
    { serviceStart: "2999-01-01" },
    { serviceStart: "2020-03-01", serviceEnd: "2020-03-01" }, // not after the start
    { serviceEnd: "2099-01-01" },
  ])
    await expect(s.updateServiceInfo(u.id, bad), JSON.stringify(bad)).rejects.toThrow("invalid");
  const cleared = await s.updateServiceInfo(u.id, {
    rank: "",
    serviceType: "",
    serviceArm: "",
    serviceStart: "",
    serviceEnd: "",
  });
  expect(cleared).toMatchObject({
    rank: null,
    serviceType: null,
    serviceArm: null,
    serviceStart: null,
    serviceEnd: null,
  });
});
