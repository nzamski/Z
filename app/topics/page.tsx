// The topics you follow, and this week's popular ones (the account menu links here).
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { FollowButton } from "@/components/buttons";
import { Loading } from "@/components/loading";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { followedTopics, popularTopics } from "@/lib/services";
import { tagHref } from "@/lib/tags";

function TopicList(p: {
  title: string;
  topics: { tag: string; posts: number }[];
  following: Set<string>;
  empty: string;
}) {
  return (
    <section className="border-b border-neutral-200 px-4 py-3 text-start dark:border-neutral-800">
      <h2 className="mb-2 font-bold">{p.title}</h2>
      {p.topics.length ? (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {p.topics.map((t) => (
            <li key={t.tag} className="flex items-center justify-between gap-3 py-2">
              <Link href={tagHref(t.tag)} className="min-w-0 flex-1 hover:underline">
                <span className="block truncate font-medium" dir="auto">
                  #{t.tag}
                </span>
                <span className="text-sm text-muted">{he.topics.posts(t.posts)}</span>
              </Link>
              {/* Keyed on the server's state: the same topic can be in both lists, and both follow. */}
              <FollowButton
                key={String(p.following.has(t.tag))}
                topic={t.tag}
                following={p.following.has(t.tag)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{p.empty}</p>
      )}
    </section>
  );
}

async function Topics() {
  await connection();
  const viewer = await requireViewer();
  const [mine, popular] = await Promise.all([followedTopics(viewer.id), popularTopics(7, 20)]);
  const following = new Set(mine.map((t) => t.tag));
  return (
    <>
      <h1 className="border-b border-neutral-200 px-4 py-3 text-start text-xl font-bold dark:border-neutral-800">
        {he.topics.title}
      </h1>
      <TopicList
        title={he.topics.mine}
        topics={mine}
        following={following}
        empty={he.topics.noneFollowed}
      />
      <TopicList
        title={he.topics.popular}
        topics={popular}
        following={following}
        empty={he.topics.nonePopular}
      />
    </>
  );
}

export const metadata: Metadata = { title: he.topics.title };

export default function Page() {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Topics />
      </Suspense>
    </main>
  );
}
