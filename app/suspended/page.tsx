import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser } from "@/lib/services";
import type { Metadata } from "next";

// Where requireLogin sends a suspended user: the only page they can see (docs/moderation.md).
async function SuspendedPage() {
  await connection();
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user) redirect("/auth/login");
  if (!user.suspendedAt) redirect("/");
  return (
    <div className="space-y-2 px-4 py-12 text-center">
      <h1 className="text-2xl font-bold">{he.moderation.suspendedTitle}</h1>
      <p className="text-muted">{he.moderation.suspendedText}</p>
    </div>
  );
}

export const metadata: Metadata = { title: he.titles.suspended };

export default function Page() {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <SuspendedPage />
      </Suspense>
    </main>
  );
}
