// A comment on its own, outside its thread (saved, liked, a profile's replies): who it answers
// (linking to the post), its body, like and save. The card opens the comment's page.
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { BookmarkButton, LikeButton } from "@/components/buttons";
import { ClickableCard } from "@/components/clickable-card";
import { Markdown } from "@/components/markdown";
import { Byline } from "@/components/post-card";
import { he } from "@/lib/i18n/he";
import type { CommentSummary } from "@/lib/services";

export function CommentCard({ comment: c }: { comment: CommentSummary }) {
  return (
    <ClickableCard
      href={`/c/${c.id}`}
      className="flex gap-3 border-b border-neutral-200 px-4 py-4 text-start dark:border-neutral-800"
    >
      <Avatar seed={c.author.avatarSeed} handle={c.author.handle} />
      <div className="min-w-0 flex-1">
        <Byline author={c.author} createdAt={c.createdAt} editedAt={c.editedAt} />
        <Link href={`/p/${c.postId}`} className="text-sm text-muted hover:underline">
          {he.bookmarks.replyTo}
          <span dir="ltr">@{c.replyTo}</span>
        </Link>
        <Markdown text={c.body} className="mt-1" />
        <div className="mt-2 flex items-center gap-8 text-sm text-muted">
          <LikeButton
            id={c.id}
            kind="comment"
            liked={c.liked}
            count={c.likeCount}
            likersHref={`/c/${c.id}/likes`}
          />
          <div className="ms-auto">
            <BookmarkButton id={c.id} kind="comment" saved={c.bookmarked} />
          </div>
        </div>
      </div>
    </ClickableCard>
  );
}
