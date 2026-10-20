"use client";
// Feed tabs. The choice is a cookie (setViewAction), not part of the URL; the form also works
// before hydration / without JS.
import { setViewAction } from "@/app/actions";
import type { FeedView } from "@/lib/feed";
import { he } from "@/lib/i18n/he";

const TABS: [FeedView, string][] = [
  ["forYou", he.nav.forYou],
  ["following", he.nav.following],
  ["latest", he.nav.latest],
  ["top", he.nav.top],
];

export function FeedTabs({ view }: { view: FeedView }) {
  return (
    <form
      action={setViewAction}
      onSubmit={() => window.scrollTo(0, 0)}
      className="sticky top-(--header-h) z-10 flex h-(--tabs-h) border-b border-neutral-200 bg-background/90 text-sm font-medium backdrop-blur dark:border-neutral-800"
    >
      {TABS.map(([v, label]) => (
        <button
          key={v}
          name="view"
          value={v}
          aria-pressed={v === view}
          className="group flex flex-1 items-end justify-center text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-pressed:text-foreground"
        >
          <span className="block border-b-2 border-transparent px-1 pb-2 group-aria-pressed:border-current">
            {label}
          </span>
        </button>
      ))}
    </form>
  );
}
