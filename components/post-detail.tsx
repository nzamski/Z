"use client";
// The post page's byline row with the post's "⋯" menu (the same as a card's), then the body. Edit
// from the menu swaps the body for the composer, right here.
import { useState } from "react";
import { editPostAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import type { Viewer } from "@/components/post-card";
import { PostMenu } from "@/components/post-menu";
import { he } from "@/lib/i18n/he";
import { POST_MAX } from "@/lib/limits";
import type { PostSummary } from "@/lib/services";

export function PostDetail(p: {
  post: PostSummary & { body: string };
  viewer: Viewer;
  byline: React.ReactNode;
  startEditing?: boolean; // opened from a card's "⋯" menu (?edit=1); the service checks the window
  children: React.ReactNode; // the rendered body
}) {
  const [editing, setEditing] = useState(!!p.startEditing && p.post.authorId === p.viewer.id);
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{p.byline}</div>
        <PostMenu post={p.post} viewer={p.viewer} onEdit={() => setEditing(true)} />
      </div>
      {editing ? (
        <div className="mt-2">
          <Composer
            action={editPostAction}
            hidden={{ id: p.post.id }}
            initial={p.post.body}
            max={POST_MAX}
            rows={3}
            placeholder={he.composer.placeholder}
            submitLabel={he.composer.save}
            onCancel={() => setEditing(false)}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : (
        p.children
      )}
    </>
  );
}
