// A page of posts and comments mixed (saved, liked, a profile's replies), with "more" as a plain
// link to the next page (?cursor=), and tabs above such lists.
import Link from "next/link";
import { CommentCard } from "@/components/comment-card";
import { PostCard, type Viewer } from "@/components/post-card";
import { he } from "@/lib/i18n/he";
import type { SavedItem } from "@/lib/services";

export function ItemList(p: {
  items: SavedItem[];
  next: string | null;
  viewer: Viewer;
  empty: string;
  href: (cursor: string) => string; // the next page's URL
}) {
  if (!p.items.length) return <p className="p-4 text-start text-muted">{p.empty}</p>;
  return (
    <>
      <ul>
        {p.items.map((x) =>
          x.kind === "post" ? (
            <PostCard key={`p:${x.post.id}`} post={x.post} viewer={p.viewer} />
          ) : (
            <CommentCard key={`c:${x.comment.id}`} comment={x.comment} />
          ),
        )}
      </ul>
      {p.next && (
        <div className="p-4 text-center text-sm">
          <Link href={p.href(p.next)} className="text-link hover:underline">
            {he.feed.loadMore}
          </Link>
        </div>
      )}
    </>
  );
}

/** Links styled as tabs; the current one is underlined (aria-current). */
export function LinkTabs(p: { tabs: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav className="flex border-b border-neutral-200 text-sm font-medium dark:border-neutral-800">
      {p.tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          className="group flex flex-1 justify-center text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-[current]:text-foreground"
        >
          <span className="block border-b-2 border-transparent px-1 py-3 group-aria-[current]:border-current">
            {t.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
