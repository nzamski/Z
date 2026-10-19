"use client";
import { useState, useTransition } from "react";
import {
  setCommentLikeAction,
  setFollowAction,
  setLikeAction,
  type ActionResult,
} from "@/app/actions";
import { he } from "@/lib/i18n/he";

// Local state, not useOptimistic: feed pages fetched on the client have no server prop that
// refresh() would update, so an optimistic value would snap back. Fresh server props still win.
export function LikeButton(p: {
  id: string;
  kind?: "post" | "comment";
  liked: boolean;
  count: number;
}) {
  const [state, setState] = useState({ liked: p.liked, count: p.count });
  const [prop, setProp] = useState(state);
  if (prop.liked !== p.liked || prop.count !== p.count) {
    setProp({ liked: p.liked, count: p.count });
    setState({ liked: p.liked, count: p.count });
  }
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const before = state;
      const liked = !state.liked;
      setState({ liked, count: state.count + (liked ? 1 : -1) });
      const r = await (p.kind === "comment" ? setCommentLikeAction : setLikeAction)(p.id, liked);
      if (r.error) setState(before);
    });
  return (
    <button
      onClick={toggle}
      aria-pressed={state.liked}
      aria-busy={pending}
      aria-label={`${state.liked ? he.post.unlike : he.post.like} · ${state.count} ${he.post.likes}`}
      className={`group -my-1 -ms-2 flex items-center tabular-nums transition-colors ${
        state.liked ? "text-like" : "hover:text-like"
      }`}
    >
      <span className="grid size-8 place-items-center rounded-full transition-colors group-hover:bg-rose-500/10 group-focus-visible:bg-rose-500/10">
        <svg
          key={String(state.liked)} // remount so the pop replays on each like
          viewBox="0 0 24 24"
          aria-hidden
          className={`size-[18px] ${state.liked ? "animate-like-pop" : ""}`}
          fill={state.liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        >
          <path d="M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.4 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.4 0 5.5 3.4 4.2 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z" />
        </svg>
      </span>
      {/* Like X: no number at zero. */}
      <span className="min-w-[1ch] text-sm">{state.count > 0 ? state.count : ""}</span>
    </button>
  );
}

// Local state rather than useOptimistic: the hover card has no server prop to refresh into.
export function FollowButton(p: {
  userId: string;
  following: boolean;
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState(p.following);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !following;
      setFollowing(next);
      const r = await setFollowAction(p.userId, next);
      if (r.error) setFollowing(!next);
      else p.onChange?.(next);
    });
  return (
    <button
      onClick={toggle}
      aria-busy={pending}
      className={
        following
          ? // X-style: hovering "unfollow" turns it red.
            "rounded-full border border-neutral-400 px-4 py-1.5 text-sm font-medium transition-colors hover:border-red-400 hover:bg-red-500/10 hover:text-danger"
          : "rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
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
      <button
        onClick={() => setArmed(true)}
        className="transition-colors hover:text-danger hover:underline"
      >
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
        className="font-medium text-danger hover:underline"
      >
        {he.post.delete}
      </button>
      <button
        onClick={() => setArmed(false)}
        className="transition-colors hover:text-foreground hover:underline"
      >
        {he.composer.cancel}
      </button>
      {error && <span className="text-danger">{error}</span>}
    </span>
  );
}
