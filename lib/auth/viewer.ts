import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/services";

/**
 * Logged in, setup possibly unfinished: only the welcome screen and its actions use this.
 * A valid cookie can still point at a user that is gone (soft-deleted, or a reseeded dev DB):
 * the proxy can't see that, so bounce through login, which re-provisions by sub.
 */
export async function requireLogin() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) redirect("/auth/login");
  return user;
}

/** Logged in AND through the welcome (so they have a handle). Everything else uses this. */
export async function requireViewer() {
  const user = await requireLogin();
  if (!user.onboardedAt || !user.handle) redirect("/welcome");
  return { ...user, handle: user.handle };
}
