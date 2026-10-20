import Link from "next/link";
import { Suspense } from "react";
import { BackLink, LogoLink } from "@/components/home-link";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser, isAdmin } from "@/lib/services";

async function AuthStatus() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  // No session: the proxy sends them to login. Setup unfinished: they're in the welcome, where
  // links to the rest of Z would only bounce back.
  // Suspended: locked out, links would only bounce back to /suspended.
  if (!user?.handle || !user.onboardedAt || user.suspendedAt) return null;
  // No logout button by request; POST /auth/logout still ends the app and Keycloak sessions.
  const admin = await isAdmin(user.id);
  return (
    <>
      {admin && (
        <Link
          href="/admin"
          aria-label={he.moderation.nav}
          title={he.moderation.nav}
          className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
        >
          {/* Shield: moderation */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
          >
            <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
          </svg>
        </Link>
      )}
      <Link
        href={`/u/${encodeURIComponent(user.handle)}`}
        className="font-medium hover:underline"
        dir="ltr"
      >
        @{user.handle}
      </Link>
      <Link
        href="/search"
        aria-label={he.nav.search}
        title={he.nav.search}
        className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </Link>
    </>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 grid h-(--header-h) grid-cols-3 items-center border-b border-neutral-200 bg-background/90 px-4 text-sm backdrop-blur dark:border-neutral-800">
      {/* usePathname() is request data under cacheComponents, so it needs a boundary. */}
      <Suspense fallback={<span />}>
        <BackLink />
      </Suspense>
      <LogoLink>
        <span className="text-5xl leading-none font-extrabold tracking-tight select-none">
          {he.appName}
        </span>
      </LogoLink>
      <div className="flex items-center gap-2 justify-self-end">
        <Suspense>
          <AuthStatus />
        </Suspense>
      </div>
    </header>
  );
}
