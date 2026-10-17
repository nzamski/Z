import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { devAuthEnabled, safeNext } from "@/lib/auth/provider";
import { startSession } from "@/lib/auth/session";
import { ListSkeleton } from "@/components/loading";
import { he } from "@/lib/i18n/he";
import { getUser, listUsers } from "@/lib/services";

async function loginAs(formData: FormData) {
  "use server";
  if (!devAuthEnabled) notFound();
  const user = await getUser(String(formData.get("uid")));
  if (!user) notFound();
  await startSession({ uid: user.id });
  redirect(safeNext(String(formData.get("next") ?? "")));
}

async function UserList({ next }: { next: Promise<string> }) {
  await connection();
  if (!devAuthEnabled) notFound();
  const [users, nextPath] = await Promise.all([listUsers(), next]);
  return (
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {users.map((u) => (
        <li key={u.id}>
          <form action={loginAs}>
            <input type="hidden" name="uid" value={u.id} />
            <input type="hidden" name="next" value={nextPath} />
            <button className="w-full px-4 py-3 text-start hover:bg-neutral-100 dark:hover:bg-neutral-900">
              <span className="font-bold">{u.displayName}</span>{" "}
              <span className="text-muted" dir="ltr">
                @{u.handle}
              </span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default function DevLogin({ searchParams }: PageProps<"/dev/login">) {
  const next = searchParams.then((p) => safeNext(typeof p.next === "string" ? p.next : null));
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 border-x border-neutral-200 dark:border-neutral-800">
      <h1 className="border-b border-neutral-200 p-4 text-start text-xl font-bold dark:border-neutral-800">
        {he.auth.devLoginTitle}
      </h1>
      <Suspense fallback={<ListSkeleton />}>
        <UserList next={next} />
      </Suspense>
    </main>
  );
}
