import Link from "next/link";
import { BookmarkButton, LikeButton } from "@/components/buttons";
import { Avatar } from "@/components/avatar";
import { ClickableCard } from "@/components/clickable-card";
import { CommentButton } from "@/components/comment-dialog";
import { PostMenu } from "@/components/post-menu";
import { Poll } from "@/components/poll";
import { PostPreview } from "@/components/post-preview";
import { ProfessionBadge } from "@/components/profession-badge";
import { UserHoverCard } from "@/components/user-hover-card";
import { ago } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import type { PostSummary } from "@/lib/services";

/** Plain user text (bios), as typed: React escapes it, newlines are kept, long words wrap. */
export function PlainText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`leading-relaxed whitespace-pre-wrap wrap-break-word ${className}`}>{text}</p>
  );
}

const Dot = () => (
  <span aria-hidden className="text-muted">
    •
  </span>
);

export function Byline(p: {
  author: { displayName: string; handle: string; profession?: string | null };
  createdAt: Date;
  editedAt: Date | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-sm text-muted">
      <UserHoverCard handle={p.author.handle}>
        <span className="inline-flex items-baseline gap-x-2">
          <Link
            href={`/u/${encodeURIComponent(p.author.handle)}`}
            className="font-bold text-foreground hover:underline"
          >
            {p.author.displayName}
          </Link>
          <span dir="ltr">@{p.author.handle}</span>
        </span>
      </UserHoverCard>
      {p.author.profession && (
        <span className="self-center">
          <ProfessionBadge profession={p.author.profession} />
        </span>
      )}
      <Dot />
      {/* Also rendered on the client (feed pages), so a minute boundary may differ. */}
      <span suppressHydrationWarning>{ago(p.createdAt)}</span>
      {p.editedAt && (
        <>
          <Dot />
          <span>{he.post.edited}</span>
        </>
      )}
    </div>
  );
}

/** The author liked a comment on this post: usually "this answered my question". */
function AnsweredMark() {
  return (
    <span
      data-tip={he.post.answeredHint}
      className="flex items-center gap-1 self-center rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-like"
    >
      <AuthorHeart />
      {he.post.answered}
    </span>
  );
}

/** Small filled heart for the post author's like on a comment. */
export function AuthorHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="currentColor">
      <path d="M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.4 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.4 0 5.5 3.4 4.2 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z" />
    </svg>
  );
}

/** `viewer`: who's reading, for the avatar in the comment popup. */
export function PostCard({
  post: p,
  viewer,
  pinned,
  onGone,
}: {
  post: PostSummary;
  viewer?: Viewer;
  pinned?: boolean; // the profile's pinned post: labeled
  onGone?: () => void; // deleted or removed from its "⋯" menu: the feed drops it
}) {
  return (
    <ClickableCard
      href={`/p/${p.id}`}
      className="flex gap-3 border-b border-neutral-200 px-4 py-4 text-start dark:border-neutral-800"
    >
      <Avatar seed={p.author.avatarSeed} handle={p.author.handle} />
      <div className="min-w-0 flex-1">
        {pinned && (
          <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
            {/* Pin */}
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
            </svg>
            {he.post.pinned}
          </p>
        )}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Byline author={p.author} createdAt={p.createdAt} editedAt={p.editedAt} />
          </div>
          {viewer && <PostMenu post={p} viewer={viewer} onGone={onGone} />}
        </div>
        <PostPreview id={p.id} preview={p.preview} hasMore={p.hasMore} />
        {p.poll && (
          <Poll postId={p.id} poll={p.poll} canVote={!!viewer && viewer.id !== p.authorId} />
        )}
        <div className="mt-2 flex gap-8 text-sm text-muted">
          <LikeButton
            id={p.id}
            liked={p.liked}
            count={p.likeCount}
            likersHref={`/p/${p.id}/likes`}
          />
          <CommentButton
            postId={p.id}
            count={p.commentCount}
            author={p.author}
            preview={p.preview}
            viewer={viewer}
          />
          {/* The far end: the answered mark, then save (as on X). */}
          <div className="ms-auto flex items-center gap-4">
            {p.answered && <AnsweredMark />}
            <BookmarkButton id={p.id} kind="post" saved={p.bookmarked} />
          </div>
        </div>
      </div>
    </ClickableCard>
  );
}

/** The signed-in user, as far as avatars and names need. */
export type Viewer = {
  id: string;
  displayName: string;
  handle: string;
  avatarSeed: string;
  admin: boolean;
};
