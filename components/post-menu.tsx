"use client";
// A post card's "⋯" menu: what the post page offers, without opening it. Yours: edit (while the
// edit window is open; on the post page, which has the full body), pin to your profile, delete.
// Someone else's: follow / unfollow its author, and remove (admins). Delete and remove confirm in
// their popups; `onGone` drops the card from its feed afterwards.
import Link from "next/link";
import { useState, useTransition } from "react";
import { deletePostAction, removePostAction, setFollowAction, setPinAction } from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { ModerateButton } from "@/components/moderate-button";
import type { Viewer } from "@/components/post-card";
import { menuClass, useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";
import { EDIT_WINDOW_MINUTES } from "@/lib/limits";
import type { PostSummary } from "@/lib/services";

const item =
  "flex w-full items-center px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-neutral-500/10";
const danger = `${item} text-danger`;

export function PostMenu(p: { post: PostSummary; viewer: Viewer; onGone?: () => void }) {
  const { open, setOpen, root } = useMenu();
  const [following, setFollowing] = useState(p.post.followsAuthor);
  const [busy, start] = useTransition();
  const mine = p.post.authorId === p.viewer.id;
  // The edit window is checked when the menu opens (not during render: it reads the clock).
  const [canEdit, setCanEdit] = useState(false);
  const pinned = p.post.pinned;
  const handle = p.post.author.handle;
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      setOpen(false);
    });
  return (
    <div ref={root} className="relative -my-1.5 -me-2">
      <button
        type="button"
        onClick={() => {
          setCanEdit(
            mine && Date.now() - p.post.createdAt.getTime() < EDIT_WINDOW_MINUTES * 60_000,
          );
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={he.post.more}
        data-tip={he.post.more}
        className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-sky-500/10 hover:text-sky-500 aria-expanded:bg-sky-500/10 aria-expanded:text-sky-500"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label={he.post.more} aria-busy={busy} className={`${menuClass} w-60`}>
          {canEdit && (
            <Link role="menuitem" href={`/p/${p.post.id}?edit=1`} className={item}>
              {he.post.edit}
            </Link>
          )}
          {mine && (
            <button
              role="menuitem"
              type="button"
              onClick={() => run(() => setPinAction(p.post.id, !pinned))}
              className={item}
            >
              {pinned ? he.post.unpin : he.post.pin}
            </button>
          )}
          {!mine && (
            <button
              role="menuitem"
              type="button"
              onClick={() =>
                run(async () => {
                  const r = await setFollowAction(p.post.authorId, !following);
                  if (!r.error) setFollowing(!following);
                })
              }
              className={item}
            >
              <bdi>{following ? he.post.unfollowAuthor(handle) : he.post.followAuthor(handle)}</bdi>
            </button>
          )}
          {mine && (
            <DeleteButton
              id={p.post.id}
              kind="post"
              action={deletePostAction}
              triggerClass={danger}
              onDone={p.onGone}
            />
          )}
          {!mine && p.viewer.admin && (
            <ModerateButton
              label={he.moderation.remove}
              danger
              action={removePostAction.bind(null, p.post.id)}
              triggerClass={danger}
              onDone={p.onGone}
            />
          )}
        </div>
      )}
    </div>
  );
}
