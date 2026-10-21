"use client";
import { useState, useTransition } from "react";
import { deletePostAction, editPostAction, setPinAction } from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { he } from "@/lib/i18n/he";
import { POST_MAX } from "@/lib/limits";

/**
 * Edit / pin to the profile / delete for the post's author. Edit only while the edit window is open (`canEdit`; the
 * service checks again). While editing, the composer replaces the rendered body.
 */
export function PostOwnerActions(p: {
  postId: string;
  body: string;
  canEdit: boolean;
  pinned: boolean; // pinned to the author's profile
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [pinning, startPin] = useTransition();
  if (editing) {
    return (
      <div className="mt-2">
        <Composer
          action={editPostAction}
          hidden={{ id: p.postId }}
          initial={p.body}
          max={POST_MAX}
          rows={3}
          placeholder={he.composer.placeholder}
          submitLabel={he.composer.save}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <>
      {p.children}
      <div className="mt-2 flex gap-4 text-sm text-muted">
        {p.canEdit && (
          <button
            onClick={() => setEditing(true)}
            className="transition-colors hover:text-foreground hover:underline"
          >
            {he.post.edit}
          </button>
        )}
        <button
          disabled={pinning}
          onClick={() => startPin(async () => void (await setPinAction(p.postId, !p.pinned)))}
          className="transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        >
          {p.pinned ? he.post.unpin : he.post.pin}
        </button>
        <DeleteButton id={p.postId} kind="post" action={deletePostAction} />
      </div>
    </>
  );
}
