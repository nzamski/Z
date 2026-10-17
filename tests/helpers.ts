import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { users } from "@/db/schema";

/** A user who has finished the welcome (has a handle). */
export async function makeUser(name = "בודק", handle?: string) {
  const tag = randomUUID().slice(0, 8);
  const h = handle ?? `u_${tag}`;
  const [u] = await db
    .insert(users)
    .values({
      keycloakSub: `test-${tag}`,
      handle: h,
      displayName: name,
      onboardedAt: new Date(),
    })
    .returning();
  return { ...u, handle: h };
}
