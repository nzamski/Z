import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import { Welcome } from "@/components/welcome";
import { safeNext } from "@/lib/auth/provider";
import { requireViewer } from "@/lib/auth/viewer";
import { suggestedUsers } from "@/lib/services";

// First login: a short welcome, profile setup (name, handle, bio), who to follow.
async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await connection();
  const user = await requireViewer();
  const raw = (await searchParams).next;
  const next = safeNext(typeof raw === "string" ? raw : "/");
  if (user.onboardedAt) redirect(next);
  return (
    <Welcome
      displayName={user.displayName}
      profile={{ handle: user.handle, bio: user.bio }}
      suggestions={await suggestedUsers(user.id)}
      next={next}
    />
  );
}

export default function Page(props: PageProps<"/welcome">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <WelcomePage {...props} />
      </Suspense>
    </main>
  );
}
