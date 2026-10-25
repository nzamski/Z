import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { Welcome } from "@/components/welcome";
import { safeNext } from "@/lib/auth/provider";
import { requireLogin } from "@/lib/auth/viewer";
import { experienceOf, suggestedUsers } from "@/lib/services";
import type { Metadata } from "next";
import { he } from "@/lib/i18n/he";

// First login (mandatory): a short welcome, choose a handle (+ bio), the current role (optional),
// who to follow.
async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await connection();
  const user = await requireLogin(); // the one page reachable before setup is done
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : "/");
  if (user.onboardedAt) redirect(next);
  // Back on the welcome (a reload) after saving a role: that step edits it instead of adding one.
  const role = (await experienceOf(user.id)).find((r) => !r.endMonth);
  return (
    <Welcome
      displayName={user.displayName}
      profile={{ handle: user.handle ?? "", bio: user.bio, avatarSeed: user.avatarSeed }}
      role={role}
      suggestions={await suggestedUsers(user.id)}
      next={next}
    />
  );
}

export const metadata: Metadata = { title: he.titles.welcome };

export default function Page(props: PageProps<"/welcome">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <WelcomePage {...props} />
      </Suspense>
    </main>
  );
}
