"use client";
// A post's "⋯" menu, on cards and on the post page. Yours: edit (while the edit window is open; a
// card opens the post page, which has the full body), pin to your profile, delete.
// Someone else's: follow / unfollow its author, and remove (admins). Delete and remove confirm in
// their popups; `onGone` drops the card from its feed afterwards.
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  deletePostAction,
  removePostAction,
  setFollowAction,
  setPinAction,
  type ActionResult,
} from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { ModerateButton } from "@/components/moderate-button";
import { ReportButton } from "@/components/report-button";
import type { Viewer } from "@/components/post-card";
import {
  MENU_ICON as ICON,
  MenuIcon as Icon,
  menuDanger as danger,
  menuItem as item,
  MoreMenu,
} from "@/components/more-menu";
import { useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";
import { EDIT_WINDOW_MINUTES } from "@/lib/limits";
import type { PostSummary } from "@/lib/services";

const PIN_EVENT = "z:pinned";

export function PostMenu(p: {
  post: PostSummary;
  viewer: Viewer;
  onGone?: () => void;
  onEdit?: () => void; // the post page: edit in place
}) {
  const menu = useMenu();
  const { setOpen } = menu;
  const [following, setFollowing] = useState(p.post.followsAuthor);
  const [busy, start] = useTransition();
  const mine = p.post.authorId === p.viewer.id;
  // The edit window is checked when the menu opens (not during render: it reads the clock).
  const [canEdit, setCanEdit] = useState(false);
  // Local, like `following`: a feed's cards aren't re-rendered after the action. The same post
  // can be on the page twice (a profile's pins and its timeline): every copy hears the change.
  const [pinned, setPinned] = useState(p.post.pinned);
  useEffect(() => {
    const hear = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; pinned: boolean }>).detail;
      if (d.id === p.post.id) setPinned(d.pinned);
    };
    addEventListener(PIN_EVENT, hear);
    return () => removeEventListener(PIN_EVENT, hear);
  }, [p.post.id]);
  const [error, setError] = useState<string>();
  const handle = p.post.author.handle;
  // Closes on success; an error (e.g. already PINS_MAX pinned) stays in the menu.
  const run = (fn: () => Promise<ActionResult>, done: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setError(r.error);
      done();
      setOpen(false);
    });
  return (
    <MoreMenu
      menu={menu}
      busy={busy}
      className="-my-1.5 -me-2"
      onOpen={() => {
        setError(undefined);
        setCanEdit(mine && Date.now() - p.post.createdAt.getTime() < EDIT_WINDOW_MINUTES * 60_000);
      }}
    >
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
          onClick={() =>
            run(
              () => setPinAction(p.post.id, !pinned),
              () =>
                dispatchEvent(
                  new CustomEvent(PIN_EVENT, { detail: { id: p.post.id, pinned: !pinned } }),
                ),
            )
          }
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
            run(
              () => setFollowAction(p.post.authorId, !following),
              () => setFollowing(!following),
            )
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
      {!mine && (
        <ReportButton
          kind="post"
          id={p.post.id}
          triggerClass={item}
          icon={<Icon d={ICON.report} />}
          onDone={() => setOpen(false)}
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
      {error && (
        <p role="alert" className="px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </MoreMenu>
  );
}
