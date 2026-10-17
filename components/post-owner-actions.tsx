"use client";
import { useState } from "react";
import { deletePostAction, editPostAction } from "@/app/actions";
import { DeleteButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { he } from "@/lib/i18n/he";
import { POST_MAX } from "@/lib/limits";

/** Edit / delete for the post's author. While editing, the composer replaces the rendered body. */
export function PostOwnerActions(p: { postId: string; body: string; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
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
        <button
          onClick={() => setEditing(true)}
          className="transition-colors hover:text-foreground hover:underline"
        >
          {he.post.edit}
        </button>
        <DeleteButton id={p.postId} action={deletePostAction} />
      </div>
    </>
  );
}
