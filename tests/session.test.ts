import { expect, test } from "vitest";
import { seal, unseal } from "@/lib/auth/session";

test("session cookie round-trips and rejects tampering and expiry", async () => {
  const token = await seal({ uid: "u1" }, 60);
  expect((await unseal<{ uid: string }>(token))?.uid).toBe("u1");

  const parts = token.split(".");
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
  expect(await unseal(parts.join("."))).toBeNull();
  expect(await unseal("garbage")).toBeNull();
  expect(await unseal(undefined)).toBeNull();
  expect(await unseal(await seal({ uid: "u1" }, -10))).toBeNull();
});
