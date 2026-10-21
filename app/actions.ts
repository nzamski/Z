"use server";
// Server Actions: auth check, input shape check, service call, refresh. Business rules live in services.
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth/provider";
import { requireLogin, requireViewer } from "@/lib/auth/viewer";
import { parseTab, VIEW_COOKIE } from "@/lib/feed";
import { mentionable } from "@/lib/mentions";
import { he } from "@/lib/i18n/he";
import * as s from "@/lib/services";

export type ActionResult = { ok?: true; error?: string };

const Id = z.uuid();
const Text = z.string();

// "full": through the welcome (everything else). "setup": logged in, welcome unfinished: only the
// welcome's own actions. Following needs at least a handle, so a handle-less user never shows up
// in anyone's followers.
async function run(
  fn: (uid: string) => Promise<unknown>,
  level: "full" | "setup" | "handle" = "full",
): Promise<ActionResult> {
  const viewer = level === "full" ? await requireViewer() : await requireLogin();
  if (level === "handle" && !viewer.handle) return { error: he.errors.invalid };
  try {
    await fn(viewer.id);
  } catch (e) {
    if (e instanceof s.ServiceError) return { error: he.errors[e.code] };
    if (e instanceof z.ZodError) return { error: he.errors.invalid };
    throw e;
  }
  refresh();
  return { ok: true };
}

const field = (f: FormData, name: string) => f.get(name) ?? undefined;

export async function createPostAction(_: ActionResult, f: FormData) {
  return run((uid) => s.createPost(uid, Text.parse(field(f, "body"))));
}

export async function editPostAction(_: ActionResult, f: FormData) {
  return run((uid) => s.editPost(uid, Id.parse(field(f, "id")), Text.parse(field(f, "body"))));
}

/** Pin your post to the top of your profile, or unpin it. */
export async function setPinAction(postId: string, pinned: boolean) {
  const id = Id.parse(postId);
  return run((uid) => (pinned ? s.pinPost(uid, id) : s.unpinPost(uid, id)));
}

export async function deletePostAction(postId: string) {
  const r = await run((uid) => s.deletePost(uid, Id.parse(postId)));
  if (r.ok) redirect("/");
  return r;
}

export async function createCommentAction(_: ActionResult, f: FormData) {
  const parent = field(f, "parentId");
  return run((uid) =>
    s.createComment(
      uid,
      Id.parse(field(f, "postId")),
      Text.parse(field(f, "body")),
      parent ? Id.parse(parent) : undefined,
    ),
  );
}

export async function deleteCommentAction(commentId: string) {
  return run((uid) => s.deleteComment(uid, Id.parse(commentId)));
}

export async function setLikeAction(postId: string, liked: boolean) {
  return run((uid) => (liked ? s.likePost : s.unlikePost)(uid, Id.parse(postId)));
}

export async function setCommentLikeAction(commentId: string, liked: boolean) {
  return run((uid) => (liked ? s.likeComment : s.unlikeComment)(uid, Id.parse(commentId)));
}

export async function setFollowAction(userId: string, following: boolean) {
  // "handle": also from the welcome's who-to-follow step.
  return run((uid) => (following ? s.follow : s.unfollow)(uid, Id.parse(userId)), "handle");
}

/** Follow or unfollow a #topic (its posts get a For You boost). */
export async function setTopicFollowAction(tag: string, following: boolean) {
  return run((uid) => (following ? s.followTopic : s.unfollowTopic)(uid, String(tag)));
}

export type TopicSuggestion = { tag: string; posts: number };

/** Topics to suggest while typing a #tag (the composer's autocomplete). */
export async function topicSuggestionsAction(prefix: string): Promise<TopicSuggestion[]> {
  await requireViewer();
  return s.topicSuggestions(String(prefix).slice(0, 30));
}

export type UserCard = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  viewerFollows: boolean;
  isSelf: boolean;
};

/** Data for the hover card on a user's name. */
export async function getUserCardAction(handle: string): Promise<UserCard | null> {
  const viewer = await requireViewer();
  const u = await s.getUserByHandle(String(handle));
  if (!u) return null;
  const info = await s.followInfo(u.id, viewer.id);
  return {
    id: u.id,
    handle: u.handle,
    displayName: u.displayName,
    bio: u.bio,
    followers: info.followers,
    following: info.following,
    viewerFollows: info.viewerFollows,
    isSelf: u.id === viewer.id,
  };
}

export type ProfileResult = ActionResult & { handle?: string };

/** Handle and bio (welcome screen and profile). Returns the saved handle. */
export async function updateProfileAction(_: ProfileResult, f: FormData): Promise<ProfileResult> {
  let handle: string | undefined;
  const r = await run(async (uid) => {
    handle =
      (
        await s.updateProfile(uid, {
          handle: Text.parse(field(f, "handle") ?? ""),
          bio: Text.parse(field(f, "bio") ?? ""),
        })
      ).handle ?? undefined;
  }, "setup");
  return { ...r, handle };
}

/** Live check while typing a handle. */
export async function checkHandleAction(handle: string) {
  const viewer = await requireLogin();
  return s.handleStatus(viewer.id, String(handle));
}

/** Finish the welcome (needs a handle) and go where the user was heading. */
export async function finishOnboardingAction(next: string) {
  const viewer = await requireLogin();
  await s.finishOnboarding(viewer.id);
  refresh(); // the shared layout (header: @handle, search) must re-render for a finished user
  redirect(safeNext(next));
}

export type MentionSuggestion = { id: string; handle: string; displayName: string };

/** People to suggest while typing an @mention (the composer's autocomplete). */
export async function mentionSuggestionsAction(q: string): Promise<MentionSuggestion[]> {
  const viewer = await requireViewer();
  const query = String(q).slice(0, 15);
  if (!query) return [];
  const found = await s.searchUsers(viewer.id, query, 8);
  return found
    .filter((u) => mentionable(u.handle))
    .slice(0, 5)
    .map((u) => ({ id: u.id, handle: u.handle, displayName: u.displayName }));
}

/** Mark notifications read up to what the page showed. No refresh(): the page keeps showing
 * which ones were new on this visit. */
export async function markNotificationsReadAction(upTo: string) {
  const viewer = await requireViewer();
  const id = Id.safeParse(upTo);
  if (id.success) await s.markNotificationsRead(viewer.id, id.data);
}

/** Remember the chosen feed tab across sessions (a cookie, so the server renders the right one). */
export async function setViewAction(f: FormData) {
  await requireViewer();
  (await cookies()).set(VIEW_COOKIE, parseTab(f.get("view")), {
    httpOnly: true,
    sameSite: "lax",
    secure: true, // like the session cookie; browsers allow it on localhost
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  refresh();
}

/** Full body for the inline "show more" in feeds; null if the post is gone. */
export async function getPostBodyAction(postId: string): Promise<string | null> {
  const viewer = await requireViewer();
  const id = Id.safeParse(postId);
  if (!id.success) return null;
  const post = await s.getPost(id.data, viewer.id);
  return post && !post.deletedAt ? post.body : null;
}

// ---- moderation: the services check that the actor is an admin (docs/moderation.md) ----

const moderation = (fn: (uid: string, id: string, reason: string) => Promise<unknown>) => {
  return (id: string, reason: string) => run((uid) => fn(uid, Id.parse(id), Text.parse(reason)));
};

export async function removePostAction(id: string, reason: string) {
  return moderation(s.removePost)(id, reason);
}
export async function restorePostAction(id: string, reason: string) {
  return moderation(s.restorePost)(id, reason);
}
export async function removeCommentAction(id: string, reason: string) {
  return moderation(s.removeComment)(id, reason);
}
export async function restoreCommentAction(id: string, reason: string) {
  return moderation(s.restoreComment)(id, reason);
}
export async function suspendUserAction(id: string, reason: string) {
  return moderation(s.suspendUser)(id, reason);
}
export async function unsuspendUserAction(id: string, reason: string) {
  return moderation(s.unsuspendUser)(id, reason);
}
export async function clearBioAction(id: string, reason: string) {
  return moderation(s.clearBio)(id, reason);
}
export async function resetHandleAction(id: string, reason: string) {
  const r = await moderation(s.resetHandle)(id, reason);
  if (r.ok) redirect("/admin"); // the profile's URL (old handle) is gone
  return r;
}
export async function revokeAdminAction(id: string, reason: string) {
  return moderation(s.revokeAdmin)(id, reason);
}

export async function grantAdminAction(_: ActionResult, f: FormData) {
  return run((uid) =>
    s.grantAdmin(uid, Text.parse(field(f, "handle")), Text.parse(field(f, "reason"))),
  );
}
