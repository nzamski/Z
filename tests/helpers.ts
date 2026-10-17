import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function makeUser(name = "בודק") {
  const tag = randomUUID().slice(0, 8);
  const [u] = await db
    .insert(users)
    .values({ keycloakSub: `test-${tag}`, handle: `u_${tag}`, displayName: name })
    .returning();
  return u;
}
