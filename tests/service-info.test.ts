// Service details on profiles (lib/service-info.ts): the checks, and what updateProfile keeps.
import { afterAll, expect, test } from "vitest";
import { sql } from "@/db/client";
import {
  age,
  daysUntil,
  isEmail,
  isPhone,
  isBirthDate,
  isServiceEnd,
  isServiceStart,
  serviceDays,
} from "@/lib/service-info";
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

test("age counts whole years; birth dates give an age of 14 to 100", () => {
  expect(age("2000-10-22", today)).toBe(26);
  expect(age("2000-10-23", today)).toBe(25); // the day before the birthday
  expect(isBirthDate("2000-01-01", today)).toBe(true);
  for (const bad of ["2015-01-01", "1900-01-01", "2000-02-30"])
    expect(isBirthDate(bad, today), bad).toBe(false);
});

test("civilian phone and email formats", () => {
  for (const ok of ["050-1234567", "+972 50 123 4567", "0501234567"])
    expect(isPhone(ok), ok).toBe(true);
  for (const bad of ["123", "050-12a4567", "-0501234567", "+972 50 123 4567 8901 23"])
    expect(isPhone(bad), bad).toBe(false);
  expect(isEmail("dana@example.com")).toBe(true);
  for (const bad of ["dana", "dana@x", "da na@x.com", "a@b@c.com"])
    expect(isEmail(bad), bad).toBe(false);
});

test("the profile saves service details, clears them with blanks, and refuses bad values", async () => {
  const u = await makeUser();
  const base = { handle: u.handle!, bio: "" };
  const saved = await s.updateProfile(u.id, {
    ...base,
    profession: "team_lead",
    rank: "captain",
    serviceType: "career",
    serviceArm: "air",
    serviceStart: "2020-03-01",
    serviceEnd: "2030-03-01",
    birthDate: "1995-06-15",
    civicPhone: "050-1234567",
    civicEmail: "Dana@Example.com",
  });
  expect(saved).toMatchObject({
    profession: "team_lead",
    rank: "captain",
    serviceType: "career",
    serviceStart: "2020-03-01",
    civicPhone: "050-1234567",
    civicEmail: "dana@example.com",
  });
  // The welcome form doesn't send them: left alone.
  expect(await s.updateProfile(u.id, base)).toMatchObject({
    rank: "captain",
    civicPhone: "050-1234567",
  });
  for (const bad of [
    { rank: "general" },
    { serviceType: "volunteer" },
    { serviceArm: "space" },
    { serviceStart: "2999-01-01" },
    { serviceStart: "2020-03-01", serviceEnd: "2020-03-01" }, // not after the start
    { serviceEnd: "2099-01-01" },
    { birthDate: "2020-01-01" }, // too young
    { civicPhone: "abc" },
    { civicEmail: "nope" },
  ])
    await expect(s.updateProfile(u.id, { ...base, ...bad }), JSON.stringify(bad)).rejects.toThrow(
      "invalid",
    );
  const cleared = await s.updateProfile(u.id, {
    ...base,
    rank: "",
    serviceType: "",
    serviceArm: "",
    serviceStart: "",
    serviceEnd: "",
    birthDate: "",
    civicPhone: "",
    civicEmail: "",
  });
  expect(cleared).toMatchObject({
    rank: null,
    serviceType: null,
    serviceArm: null,
    serviceStart: null,
    serviceEnd: null,
    birthDate: null,
    civicPhone: "",
    civicEmail: "",
  });
});
