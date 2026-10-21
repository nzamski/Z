// The end-side sidebar on wide screens: search, this week's popular topics, and who to follow.
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/buttons";
import { SidebarSearch } from "@/components/sidebar-search";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser, popularTopics, whoToFollow } from "@/lib/services";
import { tagHref } from "@/lib/tags";

const card = "rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";

export async function SideBar() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  if (!user?.handle || !user.onboardedAt || user.suspendedAt) return null;
  const [topics, people] = await Promise.all([popularTopics(7, 6), whoToFollow(user.id, 3)]);
  return (
    <div className="space-y-4 p-4 text-start">
      <SidebarSearch />

      <section className={card}>
        <h2 className="mb-2 text-lg font-bold">{he.side.popular}</h2>
        {topics.length ? (
          <ul>
            {topics.map((t) => (
              <li key={t.tag}>
                <Link
                  href={tagHref(t.tag)}
                  className="flex items-baseline justify-between gap-3 rounded-lg px-1 py-1.5 hover:bg-neutral-500/10"
                >
                  <span className="truncate font-medium">
                    <bdi>#{t.tag}</bdi>
                  </span>
                  <span className="shrink-0 text-sm text-muted">{he.topics.posts(t.posts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{he.side.noTopics}</p>
        )}
        <Link href="/topics" className="mt-2 inline-block text-sm text-link hover:underline">
          {he.side.allTopics}
        </Link>
      </section>

      <section className={card}>
        <h2 className="mb-2 text-lg font-bold">{he.side.whoToFollow}</h2>
        {people.length ? (
          <ul className="space-y-3">
            {people.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <Avatar name={u.displayName} handle={u.handle} small />
                <Link href={`/u/${encodeURIComponent(u.handle)}`} className="group min-w-0 flex-1">
                  <span className="block truncate font-bold group-hover:underline">
                    {u.displayName}
                  </span>
                  {/* bdi: "@user7" reads whole, the line stays RTL (under the name, at the right). */}
                  <span className="block truncate text-sm text-muted">
                    <bdi>@{u.handle}</bdi>
                  </span>
                </Link>
                <FollowButton userId={u.id} following={false} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{he.side.noOne}</p>
        )}
      </section>
    </div>
  );
}
