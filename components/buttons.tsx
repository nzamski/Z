"use client";
import { useOptimistic, useState, useTransition } from "react";
import { setFollowAction, setLikeAction, type ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";

export function LikeButton(p: { postId: string; liked: boolean; count: number; canLike: boolean }) {
  const [state, setOptimistic] = useOptimistic({ liked: p.liked, count: p.count });
  const [pending, start] = useTransition();
  if (!p.canLike) {
    return (
      <a href="/auth/login">
        ♡ {p.count} {he.post.likes}
      </a>
    );
  }
  const toggle = () =>
    start(async () => {
      const liked = !state.liked;
      setOptimistic({ liked, count: state.count + (liked ? 1 : -1) });
      await setLikeAction(p.postId, liked);
    });
  return (
    <button
      onClick={toggle}
      aria-pressed={state.liked}
      aria-busy={pending}
      aria-label={state.liked ? he.post.unlike : he.post.like}
      className={state.liked ? "font-medium text-rose-600" : "hover:text-rose-600"}
    >
      {state.liked ? "♥" : "♡"} {state.count} {he.post.likes}
    </button>
  );
}

export function FollowButton(p: { userId: string; following: boolean }) {
  const [following, setOptimistic] = useOptimistic(p.following);
  const [, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          setOptimistic(!following);
          await setFollowAction(p.userId, !following);
        })
      }
      className={
        following
          ? "rounded-full border border-neutral-400 px-4 py-1.5 text-sm font-medium"
          : "rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background"
      }
    >
      {following ? he.profile.unfollow : he.profile.follow}
    </button>
  );
}

/** Two-step delete (no browser confirm dialog). */
export function DeleteButton(p: { id: string; action: (id: string) => Promise<ActionResult> }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} className="hover:underline">
        {he.post.delete}
      </button>
    );
  }
  return (
    <span className="flex gap-2">
      <span>{he.post.confirmDelete}</span>
      <button
        disabled={pending}
        onClick={() => start(async () => setError((await p.action(p.id))?.error))}
        className="font-medium text-red-600 hover:underline"
      >
        {he.post.delete}
      </button>
      <button onClick={() => setArmed(false)} className="hover:underline">
        {he.composer.cancel}
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
