import Link from "next/link";
import { CommentActions } from "@/components/comment-actions";
import { Byline } from "@/components/post-card";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";
import { REPLIES_PAGE, THREAD_DEPTH, type ThreadNode } from "@/lib/services";

type Ctx = { postId: string; viewerId: string | null; postLive: boolean };

function Comment({ node: n, ctx }: { node: ThreadNode; ctx: Ctx }) {
  const hidden = n.childCount - n.children.length;
  return (
    <li
      className="border-s-2 border-neutral-200 ps-3 pt-3 dark:border-neutral-800"
      id={`c-${n.id}`}
    >
      {n.deleted ? (
        <p className="text-sm text-neutral-500 italic">{he.comment.deleted}</p>
      ) : (
        <>
          <Byline author={n.author!} createdAt={n.createdAt} editedAt={n.editedAt} />
          {/* Safe: markdown-it runs with html disabled (lib/markdown.ts). */}
          <div className="md mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(n.body!) }} />
          <CommentActions
            postId={ctx.postId}
            commentId={n.id}
            body={n.body!}
            canReply={!!ctx.viewerId && ctx.postLive}
            isOwner={ctx.viewerId === n.author!.id}
          />
        </>
      )}
      {n.childCount > 0 &&
        (n.depth >= THREAD_DEPTH ? (
          <Link
            href={`/c/${n.id}`}
            className="mt-2 inline-block text-sm text-sky-600 hover:underline"
          >
            {he.comment.continueThread} ←
          </Link>
        ) : (
          <details open className="group">
            <summary className="mt-1 cursor-pointer list-none text-xs text-neutral-500 hover:underline">
              <span className="group-open:hidden">{he.comment.expand(n.childCount)}</span>
              <span className="hidden group-open:inline">{he.comment.collapse}</span>
            </summary>
            <ul>
              {n.children.map((c) => (
                <Comment key={c.id} node={c} ctx={ctx} />
              ))}
            </ul>
            {hidden > 0 && (
              <Link
                href={`/c/${n.id}?from=${REPLIES_PAGE}`}
                className="mt-2 inline-block text-sm text-sky-600 hover:underline"
              >
                {he.comment.showMore(hidden)}
              </Link>
            )}
          </details>
        ))}
    </li>
  );
}

export function Thread(p: { nodes: ThreadNode[]; ctx: Ctx }) {
  return (
    <ul className="space-y-1">
      {p.nodes.map((n) => (
        <Comment key={n.id} node={n} ctx={p.ctx} />
      ))}
    </ul>
  );
}
