// Everyone must be logged in: no session cookie (or an invalid/expired one) → straight to login.
// Optimistic check only; pages and Server Actions still verify the session themselves.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, unseal } from "@/lib/auth/session";

export async function proxy(req: NextRequest) {
  if (await unseal(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  const login = req.nextUrl.clone();
  login.pathname = "/auth/login";
  login.search = "";
  login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except the login flow itself, the dev switcher, health probes and static assets.
  matcher: ["/((?!auth/|dev/|api/health|_next/|favicon.ico|icon.svg).*)"],
};
