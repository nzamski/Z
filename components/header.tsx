import Link from "next/link";
import { Suspense } from "react";
import { BackLink, LogoLink } from "@/components/home-link";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser } from "@/lib/services";

async function AuthStatus() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) return null; // the proxy sends anyone without a session to login
  // No logout button by request; POST /auth/logout still ends the app and Keycloak sessions.
  return (
    <Link
      href={`/u/${encodeURIComponent(user.handle)}`}
      className="font-medium hover:underline"
      dir="ltr"
    >
      @{user.handle}
    </Link>
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
      <div className="justify-self-end">
        <Suspense>
          <AuthStatus />
        </Suspense>
      </div>
    </header>
  );
}
