"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { he } from "@/lib/i18n/he";

// Navigation API (Chromium, recent Safari/Firefox). Its entries are same-origin and contiguous, so
// index > 0 means the previous entry is a page of this app, never an outside site.
const noop = () => () => {};

type Nav = { currentEntry?: { index: number } | null };
const canGoBack = () =>
  ((window as unknown as { navigation?: Nav }).navigation?.currentEntry?.index ?? 0) > 0;

/**
 * Back arrow on every page except home: back to the previous page in the app, or home when there
 * is none (opened from a link, a new tab, or a browser without the Navigation API).
 */
export function BackLink() {
  const router = useRouter();
  const pathname = usePathname();
  // With a Proxy, the server's pathname can differ from the browser's (Next docs: usePathname,
  // "Avoid hydration mismatch"): render the same placeholder on both, decide after hydration.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  // Not on home, and not in the welcome (nothing else is reachable until it's done).
  if (!hydrated || pathname === "/" || pathname === "/welcome") return <span />;
  return (
    <Link
      href="/"
      aria-label={he.nav.back}
      data-tip={he.nav.back}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || !canGoBack()) return;
        e.preventDefault();
        router.back();
      }}
      className="-ms-2 grid size-9 place-items-center justify-self-start rounded-full transition-colors hover:bg-neutral-500/15"
    >
      {/* Points right: "back" in RTL. */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/** The Z logo: goes home; on the home page itself it reloads it (fresh feed, back at the top). */
export function LogoLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      href="/"
      aria-label={he.nav.home}
      className="grid size-15 place-items-center justify-self-center rounded-full transition-colors hover:bg-neutral-500/15"
      onClick={(e) => {
        if (location.pathname !== "/" || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        window.scrollTo(0, 0); // so the browser doesn't restore the old offset after reloading
        location.reload();
      }}
    >
      {children}
    </Link>
  );
}
