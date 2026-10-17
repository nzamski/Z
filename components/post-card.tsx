import Link from "next/link";
import { LikeButton } from "@/components/buttons";
import { ClickableCard } from "@/components/clickable-card";
import { PostPreview } from "@/components/post-preview";
import { UserHoverCard } from "@/components/user-hover-card";
import { ago } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import type { PostSummary } from "@/lib/services";

/** X-style comment count: bubble icon, blue hover circle, no number at zero. */
export function CommentStat({ href, count }: { href: string; count: number }) {
  return (
    <Link
      href={href}
      aria-label={`${count} ${he.post.comments}`}
      className="group -my-1 -ms-2 flex items-center tabular-nums transition-colors hover:text-sky-500"
    >
      <span className="grid size-8 place-items-center rounded-full transition-colors group-hover:bg-sky-500/10 group-focus-visible:bg-sky-500/10">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        >
          <path d="M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1 0-1.96-.13-2.86-.38L4.5 20.5l1.2-3.6C4.03 15.55 3 13.62 3 11.5 3 7.36 7.03 4 12 4Z" />
        </svg>
      </span>
      <span className="min-w-[1ch] text-sm">{count > 0 ? count : ""}</span>
    </Link>
  );
}

/** User text, as typed: React escapes it, newlines are kept, long words wrap. */
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
  author: { displayName: string; handle: string };
  createdAt: Date;
  editedAt: Date | null;
  href?: string; // the timestamp links here (X-style; also the keyboard way into a post)
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
      <Dot />
      {/* Also rendered on the client (feed pages), so a minute boundary may differ. */}
      {p.href ? (
        <Link href={p.href} className="hover:underline" suppressHydrationWarning>
          {ago(p.createdAt)}
        </Link>
      ) : (
        <span suppressHydrationWarning>{ago(p.createdAt)}</span>
      )}
      {p.editedAt && (
        <>
          <Dot />
          <span>{he.post.edited}</span>
        </>
      )}
    </div>
  );
}

export function PostCard({ post: p }: { post: PostSummary }) {
  return (
    <ClickableCard
      href={`/p/${p.id}`}
      className="border-b border-neutral-200 px-4 py-4 text-start dark:border-neutral-800"
    >
      <Byline author={p.author} createdAt={p.createdAt} editedAt={p.editedAt} href={`/p/${p.id}`} />
      <PostPreview id={p.id} preview={p.preview} hasMore={p.hasMore} />
      <div className="mt-2 flex gap-8 text-sm text-muted">
        <LikeButton postId={p.id} liked={p.liked} count={p.likeCount} />
        <CommentStat href={`/p/${p.id}#reply`} count={p.commentCount} />
      </div>
    </ClickableCard>
  );
}
