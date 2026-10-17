import { NextResponse } from "next/server";
import { authProvider } from "@/lib/auth/provider";
import { getSession, SESSION_COOKIE } from "@/lib/auth/session";

// POST only, so a cross-site link or image cannot log users out. 303 turns it into a GET.
export async function POST() {
  const session = await getSession();
  const res = NextResponse.redirect(await authProvider().logoutUrl(session?.idt), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
