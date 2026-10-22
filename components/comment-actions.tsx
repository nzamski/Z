"use client";
import { useState } from "react";
import { createCommentAction, deleteCommentAction, removeCommentAction } from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { ModerateButton } from "@/components/moderate-button";
import { MENU_ICON, MenuIcon, menuDanger, MoreMenu } from "@/components/more-menu";
import { useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";
import { COMMENT_MAX } from "@/lib/limits";

/** A comment's "⋯" menu, at the end of its byline: delete (yours) or remove (admins). */
export function CommentMenu(p: { commentId: string; isOwner: boolean; isAdmin: boolean }) {
  const menu = useMenu();
  if (!p.isOwner && !p.isAdmin) return null;
  return (
    <MoreMenu menu={menu} className="-my-1.5 -me-2">
      {p.isOwner ? (
        <DeleteButton
          id={p.commentId}
          kind="comment"
          action={deleteCommentAction}
          triggerClass={menuDanger}
          icon={<MenuIcon d={MENU_ICON.delete} />}
        />
      ) : (
        <ModerateButton
          label={he.moderation.remove}
          danger
          action={(reason) => removeCommentAction(p.commentId, reason)}
          triggerClass={menuDanger}
          icon={<MenuIcon d={MENU_ICON.remove} />}
          onDone={() => menu.setOpen(false)}
        />
      )}
    </MoreMenu>
  );
}

/** Like and reply under one comment (comments can't be edited); delete and remove are in its
 * "⋯" menu (CommentMenu). */
export function CommentActions(p: {
  postId: string;
  commentId: string;
  canReply: boolean;
  like?: React.ReactNode; // the comment's like button, first in the row
  bookmark?: React.ReactNode; // its save button, at the row's far end
  author?: { displayName: string; handle: string }; // the viewer, for the reply box
}) {
  const [mode, setMode] = useState<"idle" | "reply">("idle");
  const close = () => setMode("idle");
  return (
    <div className="mt-1 text-sm text-muted">
      <div className="flex items-center gap-4">
        {p.like}
        {p.canReply && (
          <button
            onClick={() => setMode("reply")}
            className="transition-colors hover:text-foreground hover:underline"
          >
            {he.comment.reply}
          </button>
        )}
        {p.bookmark && <span className="ms-auto">{p.bookmark}</span>}
      </div>
      {mode === "reply" && (
        <div className="mt-2">
          <Composer
            action={createCommentAction}
            hidden={{ postId: p.postId, parentId: p.commentId }}
            draft={`reply:${p.commentId}`}
            author={p.author}
            compact
            max={COMMENT_MAX}
            rows={2}
            placeholder={he.comment.replyPlaceholder}
            submitLabel={he.comment.send}
            onCancel={close}
            onDone={close}
          />
        </div>
      )}
    </div>
  );
}
