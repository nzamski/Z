import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/account-menu";
import { BackLink, LogoLink } from "@/components/home-link";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-menu";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser, isAdmin, unreadNotifications, openReportCount } from "@/lib/services";

async function AuthStatus() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  // No session: the proxy sends them to login. Setup unfinished: they're in the welcome, where
  // links to the rest of Z would only bounce back.
  // Suspended: locked out, links would only bounce back to /suspended.
  // They still get the theme switch, which otherwise lives in the account menu.
  if (!user?.handle || !user.onboardedAt || user.suspendedAt) return <ThemeToggle />;
  // No logout button by request; POST /auth/logout still ends the app and Keycloak sessions.
  const [admin, unread] = await Promise.all([isAdmin(user.id), unreadNotifications(user.id)]);
  const reports = admin ? await openReportCount() : 0;
  // DOM order runs right to left (RTL): search nearest the logo, the account menu at the edge.
  // From lg up the navigation rail has these (components/nav-rail.tsx).
  return (
    <div className="flex items-center gap-2 lg:hidden">
      <Link
        href="/search"
        aria-label={he.nav.search}
        data-tip={he.nav.search}
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
      <NotificationBell initial={unread} />
      <AccountMenu
        handle={user.handle}
        avatarSeed={user.avatarSeed}
        displayName={user.displayName}
        admin={admin}
        reports={reports}
      />
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 grid h-(--header-h) grid-cols-3 items-center border-b border-neutral-200 bg-background/90 px-4 text-sm backdrop-blur dark:border-neutral-800">
      {/* usePathname() is request data under cacheComponents, so it needs a boundary. */}
      <Suspense fallback={<span />}>
        <BackLink />
      </Suspense>
      <LogoLink>
        {/* "Z"; on hover it spells out "Zed". */}
        <span
          dir="ltr"
          className="flex items-baseline text-5xl leading-none font-extrabold tracking-tight select-none"
        >
          {he.appName}
          {/* The space opens smoothly (grid 0fr → 1fr) while each letter rises and fades in, one
              after the other; leaving plays it back. */}
          <span
            aria-hidden
            className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:grid-cols-[1fr]"
          >
            <span className="flex min-w-0 overflow-hidden">
              {[...he.appFullName.slice(he.appName.length)].map((c, i) => (
                <span
                  key={i}
                  style={{ transitionDelay: `${80 + i * 70}ms` }}
                  className="inline-block translate-y-3 opacity-0 transition-[translate,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {c}
                </span>
              ))}
            </span>
          </span>
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
