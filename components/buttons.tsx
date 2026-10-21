"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import {
  setCommentLikeAction,
  setFollowAction,
  setTopicFollowAction,
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
  likersHref?: string; // the count links to who liked it
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
  const count = state.count > 0 ? state.count : ""; // like X: no number at zero
  return (
    <span className={`flex items-center tabular-nums ${state.liked ? "text-like" : ""}`}>
      <button
        onClick={toggle}
        aria-pressed={state.liked}
        aria-busy={pending}
        aria-label={`${state.liked ? he.post.unlike : he.post.like} · ${state.count} ${he.post.likes}`}
        data-tip={state.liked ? he.post.unlike : he.post.like}
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
      </button>
      {count && p.likersHref ? (
        <Link
          href={p.likersHref}
          aria-label={he.likers.show(state.count)}
          data-tip={he.likers.show(state.count)}
          className="min-w-[1ch] text-sm hover:underline"
        >
          {count}
        </Link>
      ) : (
        <span className="min-w-[1ch] text-sm">{count}</span>
      )}
    </span>
  );
}

// Local state rather than useOptimistic: the hover card has no server prop to refresh into.
/** Follow a person (userId) or a #topic (topic). */
export function FollowButton(p: {
  userId?: string;
  topic?: string;
  following: boolean;
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState(p.following);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !following;
      setFollowing(next);
      const r = p.topic
        ? await setTopicFollowAction(p.topic, next)
        : await setFollowAction(p.userId!, next);
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

/** Delete behind a confirmation popup (styled like edit profile; a native <dialog>, not the
 * browser's confirm()). Esc or a click outside cancels. */
export function DeleteButton(p: {
  id: string;
  kind: "post" | "comment";
  action: (id: string) => Promise<ActionResult>;
  triggerClass?: string; // e.g. as an item in a post's "⋯" menu
  icon?: React.ReactNode; // before the label (in a menu)
  onDone?: () => void; // after a successful delete (a feed drops the card)
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const close = () => dialog.current?.close();
  const titleId = `delete-${p.id}`;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          dialog.current?.showModal();
        }}
        className={p.triggerClass ?? "transition-colors hover:text-danger hover:underline"}
      >
        {p.icon}
        {he.post.delete}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] cursor-auto rounded-2xl bg-background p-0 text-start text-base font-normal text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-2 p-5 sm:p-6">
          <h2 id={titleId} className="text-xl font-bold">
            {p.kind === "post" ? he.post.deletePostTitle : he.post.deleteCommentTitle}
          </h2>
          <p className="text-muted">{he.post.deleteCannotUndo}</p>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await p.action(p.id);
                  if (r?.error) setError(r.error);
                  else {
                    close();
                    p.onDone?.();
                  }
                })
              }
              className="flex-1 rounded-full bg-red-600 py-2 font-medium text-white transition-opacity enabled:hover:opacity-90 disabled:opacity-50"
            >
              {he.post.delete}
            </button>
            <button
              type="button"
              autoFocus // not the delete button: an Enter right after opening must not delete
              onClick={close}
              className="flex-1 rounded-full border border-neutral-400 py-2 font-medium transition-colors hover:bg-neutral-500/10"
            >
              {he.composer.cancel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
