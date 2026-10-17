import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authProvider } from "@/lib/auth/provider";

export async function GET() {
  await connection(); // request-time only: never contact Keycloak during `next build`
  redirect(await authProvider().loginUrl());
}
