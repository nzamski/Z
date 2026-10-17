import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { finishLogin } from "@/lib/auth/keycloak";
import { appUrl, safeNext } from "@/lib/auth/provider";
import { startSession } from "@/lib/auth/session";
import { upsertUserFromClaims } from "@/lib/services";

export async function GET(req: NextRequest) {
  // Rebuild from the public base URL: behind the OpenShift router req.url is the internal host.
  const { claims, idToken, next } = await finishLogin(
    appUrl(`/auth/callback${req.nextUrl.search}`),
  );
  const user = await upsertUserFromClaims(claims);
  await startSession({ uid: user.id, idt: idToken });
  // First time here (or setup not finished yet): the welcome, then where they were heading.
  if (!user.onboardedAt) redirect(`/welcome?next=${encodeURIComponent(safeNext(next))}`);
  redirect(safeNext(next));
}
