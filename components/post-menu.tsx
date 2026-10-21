"use client";
// A post's "⋯" menu, on cards and on the post page. Yours: edit (while the edit window is open; a
// card opens the post page, which has the full body), pin to your profile, delete.
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
  "flex w-full items-center gap-3 px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-neutral-500/10";
const danger = `${item} text-danger`;

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}
const ICON = {
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z",
  unpin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6ZM3 3l18 18",
  follow: "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a7 7 0 0 1 14 0M19 8v6M16 11h6",
  unfollow: "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a7 7 0 0 1 14 0M16 11h6",
  delete: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  remove: "M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3ZM9 9l6 6M15 9l-6 6",
};

export function PostMenu(p: {
  post: PostSummary;
  viewer: Viewer;
  onGone?: () => void;
  onEdit?: () => void; // the post page: edit in place
}) {
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
          {canEdit &&
            (p.onEdit ? (
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  p.onEdit?.();
                }}
                className={item}
              >
                <Icon d={ICON.edit} />
                {he.post.edit}
              </button>
            ) : (
              <Link role="menuitem" href={`/p/${p.post.id}?edit=1`} className={item}>
                <Icon d={ICON.edit} />
                {he.post.edit}
              </Link>
            ))}
          {mine && (
            <button
              role="menuitem"
              type="button"
              onClick={() => run(() => setPinAction(p.post.id, !pinned))}
              className={item}
            >
              <Icon d={pinned ? ICON.unpin : ICON.pin} />
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
              <Icon d={following ? ICON.unfollow : ICON.follow} />
              <bdi>{following ? he.post.unfollowAuthor(handle) : he.post.followAuthor(handle)}</bdi>
            </button>
          )}
          {mine && (
            <DeleteButton
              id={p.post.id}
              kind="post"
              action={deletePostAction}
              triggerClass={danger}
              icon={<Icon d={ICON.delete} />}
              onDone={p.onGone}
            />
          )}
          {!mine && p.viewer.admin && (
            <ModerateButton
              label={he.moderation.remove}
              danger
              action={removePostAction.bind(null, p.post.id)}
              triggerClass={danger}
              icon={<Icon d={ICON.remove} />}
              onDone={p.onGone}
            />
          )}
        </div>
      )}
    </div>
  );
}
