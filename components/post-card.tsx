import Link from "next/link";
import { LikeButton } from "@/components/buttons";
import { ago } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";
import type { PostSummary } from "@/lib/services";

export function Byline(p: {
  author: { displayName: string; handle: string; unit?: string };
  createdAt: Date;
  editedAt: Date | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <Link
        href={`/u/${encodeURIComponent(p.author.handle)}`}
        className="font-bold hover:underline"
      >
        {p.author.displayName}
      </Link>
      <span className="text-neutral-500" dir="ltr">
        @{p.author.handle}
      </span>
      {p.author.unit && <span className="text-neutral-500">· {p.author.unit}</span>}
      <span className="text-neutral-500">· {ago(p.createdAt)}</span>
      {p.editedAt && <span className="text-neutral-500">· {he.post.edited}</span>}
    </div>
  );
}

export function PostCard({ post: p, viewerId }: { post: PostSummary; viewerId: string | null }) {
  return (
    <li className="border-b border-neutral-200 px-4 py-4 text-start dark:border-neutral-800">
      <Byline author={p.author} createdAt={p.createdAt} editedAt={p.editedAt} />
      {/* Safe: markdown-it runs with html disabled (lib/markdown.ts). */}
      <div className="md mt-1" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.preview) }} />
      {p.hasMore && (
        <Link
          href={`/p/${p.id}`}
          className="mt-1 inline-block text-sm text-sky-600 hover:underline"
        >
          {he.post.readMore}…
        </Link>
      )}
      <div className="mt-2 flex gap-6 text-sm text-neutral-500">
        <LikeButton postId={p.id} liked={p.liked} count={p.likeCount} canLike={!!viewerId} />
        <Link href={`/p/${p.id}`} className="hover:underline">
          {p.commentCount} {he.post.comments}
        </Link>
      </div>
    </li>
  );
}
