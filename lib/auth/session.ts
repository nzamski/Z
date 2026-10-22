// Encrypted cookie session: holds only the Z user id, expiry, and the ID token for logout.
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "z_session";
// Short on purpose: Z can't see a user disabled in Keycloak until their session ends, and while
// Keycloak's SSO session lasts, the next login is just a redirect (docs/security-notes.md).
const MAX_AGE_S = Number(process.env.SESSION_MAX_AGE_HOURS ?? 4) * 3600;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 chars");
  return createHash("sha256").update(secret).digest();
}

export const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge }) as const;

export async function seal(payload: JWTPayload, maxAgeS: number) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeS)
    .encrypt(key());
}

/** Returns the payload, or null if the token is missing, tampered with, or expired. */
export async function unseal<T extends JWTPayload>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtDecrypt(token, key())).payload as T;
  } catch {
    return null;
  }
}

export type Session = { uid: string; idt?: string };

export async function getSession() {
  return unseal<Session>((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function startSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, await seal(session, MAX_AGE_S), cookieOptions(MAX_AGE_S));
}
