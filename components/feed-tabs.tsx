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
];

export function FeedTabs({ view }: { view: FeedView }) {
  return (
    <form
      action={setViewAction}
      onSubmit={() => window.scrollTo(0, 0)}
      className="sticky top-(--header-h) z-10 flex h-(--tabs-h) items-end gap-6 border-b border-neutral-200 bg-background/90 px-4 text-sm font-medium backdrop-blur dark:border-neutral-800"
    >
      {TABS.map(([v, label]) => (
        <button
          key={v}
          name="view"
          value={v}
          aria-pressed={v === view}
          className="border-b-2 border-transparent pb-2 text-neutral-500 aria-pressed:border-current aria-pressed:text-foreground"
        >
          {label}
        </button>
      ))}
    </form>
  );
}
