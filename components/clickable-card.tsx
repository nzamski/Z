"use client";
// X-style: clicking a post card's empty space opens the post. Real links/buttons keep their own
// behavior, and selecting text doesn't navigate. The timestamp isn't a link, so keyboard and
// screen-reader users get a link of their own that shows only when focused.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { he } from "@/lib/i18n/he";

// dialog: the comment popup lives inside the card, and its clicks bubble here.
// [role=menu]: a card's "⋯" menu, whose padding shouldn't open the post either.
const INTERACTIVE = "a, button, input, textarea, summary, dialog, [role=dialog], [role=menu]";

export function ClickableCard(p: {
  href: string;
  className: string;
  children: React.ReactNode;
  srLink?: false; // the card already has a link to the same place (a person's name)
}) {
  const router = useRouter();
  return (
    <li
      className={`relative cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03] ${p.className}`}
      onClick={(e) => {
        if ((e.target as Element).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) window.open(p.href, "_blank");
        else router.push(p.href);
      }}
    >
      {p.children}
      {p.srLink !== false && (
        <Link
          href={p.href}
          className="sr-only text-sm text-link focus:not-sr-only focus:absolute focus:end-4 focus:top-4 focus:underline"
        >
          {he.post.open}
        </Link>
      )}
    </li>
  );
}
