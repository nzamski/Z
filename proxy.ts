// Everyone must be logged in: no session cookie (or an invalid/expired one) → straight to login.
// Optimistic check only; pages and Server Actions still verify the session themselves.
// Also sets the Content-Security-Policy (the other security headers are in next.config.ts).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, unseal } from "@/lib/auth/session";

// No nonces: partial prerendering serves static shells that can't carry a per-request nonce
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md), so inline scripts
// are allowed. What this still buys: nothing loads from, frames, or posts to another origin.
// form-action also allows the Keycloak issuer: a form posting to /auth/logout redirects there.
function contentSecurityPolicy() {
  let issuer = "";
  try {
    issuer = new URL(process.env.OIDC_ISSUER ?? "").origin;
  } catch {}
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`, // React dev tooling uses eval
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self'${issuer ? ` ${issuer}` : ""}`,
    "frame-ancestors 'none'",
  ].join("; ");
}
const CSP = contentSecurityPolicy();

export async function proxy(req: NextRequest) {
  let res: NextResponse;
  if (await unseal(req.cookies.get(SESSION_COOKIE)?.value)) res = NextResponse.next();
  else {
    const login = req.nextUrl.clone();
    login.pathname = "/auth/login";
    login.search = "";
    login.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    res = NextResponse.redirect(login);
  }
  res.headers.set("Content-Security-Policy", CSP);
  return res;
}

export const config = {
  // Everything except the login flow itself, the dev switcher, health probes and static assets.
  matcher: ["/((?!auth/|dev/|api/health|_next/|favicon.ico|icon.svg).*)"],
};
