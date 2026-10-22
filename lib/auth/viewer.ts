import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser, isAdmin, recordVisit } from "@/lib/services";

/**
 * Logged in, setup possibly unfinished: only the welcome screen and its actions use this.
 * Suspended users are locked out of everything: they only ever see /suspended.
 * A valid cookie can still point at a user that is gone (soft-deleted, or a reseeded dev DB):
 * the proxy can't see that, so bounce through login, which re-provisions by sub.
 */
export async function requireLogin() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) redirect("/auth/login");
  if (user.suspendedAt) redirect("/suspended");
  return user;
}

/** Logged in AND through the welcome (so they have a handle). Everything else uses this.
 * Also records today's visit for the usage dashboard (once a day per user and server process). */
export async function requireViewer() {
  const user = await requireLogin();
  if (!user.onboardedAt || !user.handle) redirect("/welcome");
  // Counting is never worth failing a page over.
  await recordVisit(user.id).catch((e) => console.warn("recordVisit failed:", e));
  return { ...user, handle: user.handle };
}

/** An admin (moderation pages). Everyone else gets a plain 404: the page doesn't exist for them. */
export async function requireAdmin() {
  const viewer = await requireViewer();
  if (!(await isAdmin(viewer.id))) notFound();
  return viewer;
}

/**
 * For generateMetadata, which runs beside the page and can't redirect: whether this request may
 * see content in titles at all (a live, not suspended user). Otherwise pages use a plain title.
 */
export async function canSeeContent() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  return !!user && !user.suspendedAt;
}

/** What client components need about the viewer: avatar and name, and for a post's "⋯" menu,
 * whether they moderate. Safe to hand to client components. */
export const viewerCard = async (v: {
  id: string;
  displayName: string;
  handle: string;
  avatarSeed: string;
}) => ({
  id: v.id,
  displayName: v.displayName,
  handle: v.handle,
  avatarSeed: v.avatarSeed,
  admin: await isAdmin(v.id),
});
