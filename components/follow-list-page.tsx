import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { UserRow } from "@/components/user-row";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { followList, getUserByHandle } from "@/lib/services";

/** /u/[handle]/followers and /following: one page of people, newest follow first. */
export async function FollowListPage(p: {
  handle: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  which: "followers" | "following";
}) {
  await connection();
  const handle = decodeURIComponent((await p.handle).handle);
  const user = await getUserByHandle(handle);
  if (!user) return <p className="p-8 text-center text-muted">{he.profile.notFound}</p>;
  const viewer = await requireViewer();
  const before = z.uuid().safeParse((await p.searchParams).before);
  const page = await followList(user.id, viewer.id, p.which, before.data);
  const base = `/u/${encodeURIComponent(user.handle)}`;
  const tabs = [
    ["following", he.profile.following],
    ["followers", he.profile.followers],
  ] as const;
  return (
    <>
      <div className="border-b border-neutral-200 px-4 pt-3 text-start dark:border-neutral-800">
        <div className="flex min-w-0 items-baseline gap-x-2">
          <Link href={base} className="truncate font-bold hover:underline">
            {user.displayName}
          </Link>
          <span className="shrink-[3] truncate text-sm text-muted" dir="ltr">
            @{user.handle}
          </span>
        </div>
        <nav className="mt-2 flex text-sm font-medium">
          {tabs.map(([w, label]) => (
            <Link
              key={w}
              href={`${base}/${w}`}
              aria-current={w === p.which ? "page" : undefined}
              className="group flex flex-1 justify-center text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-[current]:text-foreground"
            >
              <span className="block border-b-2 border-transparent px-1 py-2 group-aria-[current]:border-current">
                {label}
              </span>
            </Link>
          ))}
        </nav>
      </div>
      {page.items.length ? (
        <ul>
          {page.items.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              viewerFollows={u.viewerFollows}
              isSelf={u.id === viewer.id}
            />
          ))}
        </ul>
      ) : (
        <p className="p-4 text-start text-muted">
          {p.which === "followers" ? he.profile.noFollowers : he.profile.noFollowing}
        </p>
      )}
      {page.next && (
        <div className="p-4 text-center text-sm">
          <Link href={`?before=${page.next}`} className="text-link hover:underline">
            {he.feed.loadMore}
          </Link>
        </div>
      )}
    </>
  );
}
