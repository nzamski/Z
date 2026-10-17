import { connection } from "next/server";
import { Suspense } from "react";
import { createPostAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { Loading } from "@/components/loading";
import { PostCard } from "@/components/post-card";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { latestPosts } from "@/lib/services";

const tabs = [he.nav.forYou, he.nav.following, he.nav.latest];

async function Home() {
  await connection();
  const viewerId = (await getSession())?.uid ?? null;
  const posts = await latestPosts(viewerId);
  return (
    <>
      {viewerId && (
        <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
          <Composer
            action={createPostAction}
            max={20_000}
            placeholder={he.composer.placeholder}
            submitLabel={he.composer.publish}
          />
        </div>
      )}
      {posts.length ? (
        <ul>
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </ul>
      ) : (
        <p className="p-4 text-start text-neutral-500">{he.feed.empty}</p>
      )}
    </>
  );
}

export default function Page() {
  return (
    <main>
      <nav className="flex gap-6 border-b border-neutral-200 px-4 pt-3 text-sm font-medium dark:border-neutral-800">
        {tabs.map((t) => (
          <span key={t} className="pb-2 first:border-b-2 first:border-current">
            {t}
          </span>
        ))}
      </nav>
      <Suspense fallback={<Loading />}>
        <Home />
      </Suspense>
    </main>
  );
}
