import { connection } from "next/server";
import { Suspense } from "react";
import { FollowButton } from "@/components/buttons";
import { Loading } from "@/components/loading";
import { PostCard } from "@/components/post-card";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { followInfo, getUserByHandle, latestPosts } from "@/lib/services";

async function Profile({ params }: PageProps<"/u/[handle]">) {
  await connection();
  const handle = decodeURIComponent((await params).handle);
  const user = await getUserByHandle(handle);
  if (!user) return <p className="p-8 text-center text-neutral-500">{he.profile.notFound}</p>;
  const viewerId = (await getSession())?.uid ?? null;
  const [info, posts] = await Promise.all([
    followInfo(user.id, viewerId),
    latestPosts(viewerId, { authorId: user.id }),
  ]);

  return (
    <>
      <section className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{user.displayName}</h2>
            <p className="text-neutral-500" dir="ltr">
              @{user.handle}
            </p>
          </div>
          {viewerId && viewerId !== user.id && (
            <FollowButton userId={user.id} following={info.viewerFollows} />
          )}
        </div>
        {(user.roleTitle || user.unit) && (
          <p className="mt-2 text-sm">{[user.roleTitle, user.unit].filter(Boolean).join(" · ")}</p>
        )}
        {user.bio && <p className="mt-2">{user.bio}</p>}
        <div className="mt-3 flex gap-4 text-sm text-neutral-500">
          <span>
            <b className="text-foreground">{info.followers}</b> {he.profile.followers}
          </span>
          <span>
            <b className="text-foreground">{info.following}</b> {he.profile.following}
          </span>
        </div>
      </section>
      <ul>
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </ul>
    </>
  );
}

export default function Page(props: PageProps<"/u/[handle]">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Profile {...props} />
      </Suspense>
    </main>
  );
}
