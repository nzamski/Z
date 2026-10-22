// Keycloak in every real environment; the dev switcher only outside production.
import { devProvider } from "./dev";
import { keycloakProvider } from "./keycloak";

export interface AuthProvider {
  /** Where to send the browser to start a login; `next` is the local path to return to. */
  loginUrl(next: string): Promise<string>;
  /** Where to send the browser after the session cookie is cleared. */
  logoutUrl(idToken?: string): Promise<string>;
}

export const devAuthEnabled = process.env.NODE_ENV !== "production";

export function authProvider(): AuthProvider {
  if (process.env.AUTH_PROVIDER === "dev") {
    if (!devAuthEnabled) throw new Error("AUTH_PROVIDER=dev is not allowed in production");
    return devProvider;
  }
  return keycloakProvider;
}

export const appUrl = (path = "/") => new URL(path, process.env.APP_URL ?? "http://localhost:3000");

/** Only same-origin paths, so `?next=` can't become an open redirect. */
export const safeNext = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
