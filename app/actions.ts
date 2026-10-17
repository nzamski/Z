"use server";
// Server Actions: auth check, input shape check, service call, refresh. Business rules live in services.
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import * as s from "@/lib/services";

export type ActionResult = { ok?: true; error?: string };

const Id = z.uuid();
const Text = z.string();

async function run(fn: (uid: string) => Promise<unknown>): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: he.errors.unauthenticated };
  try {
    await fn(session.uid);
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

export async function editCommentAction(_: ActionResult, f: FormData) {
  return run((uid) => s.editComment(uid, Id.parse(field(f, "id")), Text.parse(field(f, "body"))));
}

export async function deleteCommentAction(commentId: string) {
  return run((uid) => s.deleteComment(uid, Id.parse(commentId)));
}

export async function setLikeAction(postId: string, liked: boolean) {
  return run((uid) => (liked ? s.likePost : s.unlikePost)(uid, Id.parse(postId)));
}

export async function setFollowAction(userId: string, following: boolean) {
  return run((uid) => (following ? s.follow : s.unfollow)(uid, Id.parse(userId)));
}
