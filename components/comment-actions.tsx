"use client";
import { useState } from "react";
import { createCommentAction, deleteCommentAction, removeCommentAction } from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { ModerateButton } from "@/components/moderate-button";
import { he } from "@/lib/i18n/he";
import { COMMENT_MAX } from "@/lib/limits";

/** Reply / delete controls under one comment (comments can't be edited); admins also get a
 * moderator removal. */
export function CommentActions(p: {
  postId: string;
  commentId: string;
  canReply: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  like?: React.ReactNode; // the comment's like button, first in the row
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
        {p.isOwner && <DeleteButton id={p.commentId} action={deleteCommentAction} />}
        {p.isAdmin && !p.isOwner && (
          <ModerateButton
            label={he.moderation.remove}
            danger
            action={(reason) => removeCommentAction(p.commentId, reason)}
          />
        )}
      </div>
      {mode === "reply" && (
        <div className="mt-2">
          <Composer
            action={createCommentAction}
            hidden={{ postId: p.postId, parentId: p.commentId }}
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
