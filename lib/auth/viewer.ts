import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/services";

/**
 * The logged-in user. A valid cookie can still point at a user that is gone (soft-deleted, or a
 * reseeded dev DB): the proxy can't see that, so bounce through login, which re-provisions by sub.
 */
export async function requireViewer() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) redirect("/auth/login");
  return user;
}
