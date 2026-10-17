"use client";
// X-style: clicking a post card's empty space opens the post. Real links/buttons keep their own
// behavior, and selecting text doesn't navigate. Keyboard users use the post's own links.
import { useRouter } from "next/navigation";

const INTERACTIVE = "a, button, input, textarea, summary, [role=dialog]";

export function ClickableCard(p: { href: string; className: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <li
      className={`cursor-pointer transition-colors hover:bg-neutral-50 dark:hover:bg-white/[0.03] ${p.className}`}
      onClick={(e) => {
        if ((e.target as Element).closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        if (e.metaKey || e.ctrlKey) window.open(p.href, "_blank");
        else router.push(p.href);
      }}
    >
      {p.children}
    </li>
  );
}
