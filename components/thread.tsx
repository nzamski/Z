import Link from "next/link";
import { restoreCommentAction } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { CommentActions, CommentMenu } from "@/components/comment-actions";
import { ModerateButton } from "@/components/moderate-button";
import { Markdown } from "@/components/markdown";
import { BookmarkButton, LikeButton } from "@/components/buttons";
import { AuthorHeart, Byline } from "@/components/post-card";
import { he } from "@/lib/i18n/he";
import { REPLIES_PAGE, THREAD_DEPTH, type ThreadNode } from "@/lib/services";

type Ctx = {
  postId: string;
  viewerId: string | null;
  viewer?: { displayName: string; handle: string } | null; // the reply box's avatar
  postLive: boolean;
  isAdmin: boolean;
};

function Comment({ node: n, ctx }: { node: ThreadNode; ctx: Ctx }) {
  const hidden = n.childCount - n.children.length;
  return (
    <li
      className="border-s-2 border-neutral-200 ps-3 pt-3 dark:border-neutral-800"
      id={`c-${n.id}`}
    >
      {n.deleted ? (
        <div className="flex gap-4 text-sm text-muted">
          <p className="italic">{n.removed ? he.comment.removed : he.comment.deleted}</p>
          {n.removed && ctx.isAdmin && (
            <ModerateButton
              label={he.moderation.restore}
              action={restoreCommentAction.bind(null, n.id)}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Avatar name={n.author!.displayName} handle={n.author!.handle} small />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Byline author={n.author!} createdAt={n.createdAt} editedAt={n.editedAt} />
              </div>
              <CommentMenu
                commentId={n.id}
                isOwner={ctx.viewerId === n.author!.id}
                isAdmin={ctx.isAdmin}
              />
            </div>
            {n.authorLiked && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-like">
                <AuthorHeart />
                {he.comment.authorLiked}
              </p>
            )}
            <Markdown text={n.body!} className="mt-1" />
            <CommentActions
              postId={ctx.postId}
              commentId={n.id}
              canReply={!!ctx.viewerId && ctx.postLive}
              author={ctx.viewer ?? undefined}
              bookmark={<BookmarkButton id={n.id} kind="comment" saved={n.bookmarked} />}
              like={
                <LikeButton
                  id={n.id}
                  kind="comment"
                  liked={n.liked}
                  count={n.likeCount}
                  likersHref={`/c/${n.id}/likes`}
                />
              }
            />
          </div>
        </div>
      )}
      {n.childCount > 0 &&
        (n.depth >= THREAD_DEPTH ? (
          <Link href={`/c/${n.id}`} className="mt-2 inline-block text-sm text-link hover:underline">
            {he.comment.continueThread} ←
          </Link>
        ) : (
          <details open className="group">
            <summary className="mt-1 cursor-pointer list-none text-xs text-muted hover:underline">
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
                className="mt-2 inline-block text-sm text-link hover:underline"
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
