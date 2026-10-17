"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { he } from "@/lib/i18n/he";

/** Back-to-home arrow shown in the header on every page except home. */
export function HomeLink() {
  if (usePathname() === "/") return <span />;
  return (
    <Link
      href="/"
      aria-label={he.nav.home}
      title={he.nav.home}
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
      className="justify-self-center"
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
