import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser } from "@/lib/services";

async function AuthStatus() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) return null; // the proxy sends anyone without a session to login
  return (
    <div className="flex items-center gap-3">
      <Link href={`/u/${encodeURIComponent(user.handle)}`} className="font-medium" dir="ltr">
        @{user.handle}
      </Link>
      <form action="/auth/logout" method="post">
        <button className="text-neutral-500 hover:underline">{he.auth.logout}</button>
      </form>
    </div>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 grid grid-cols-3 items-center border-b border-neutral-200 bg-background/90 px-4 py-3 text-sm backdrop-blur dark:border-neutral-800">
      <span />
      <Link href="/" aria-label={he.nav.home} className="justify-self-center">
        <span className="text-5xl leading-none font-extrabold tracking-tight select-none">
          {he.appName}
        </span>
      </Link>
      <div className="justify-self-end">
        <Suspense>
          <AuthStatus />
        </Suspense>
      </div>
    </header>
  );
}
