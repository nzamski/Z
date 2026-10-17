import { redirect } from "next/navigation";
import { connection, type NextRequest } from "next/server";
import { authProvider, safeNext } from "@/lib/auth/provider";

export async function GET(req: NextRequest) {
  await connection(); // request-time only: never contact Keycloak during `next build`
  redirect(await authProvider().loginUrl(safeNext(req.nextUrl.searchParams.get("next"))));
}
