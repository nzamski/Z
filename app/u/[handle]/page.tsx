import { connection } from "next/server";
import { Suspense } from "react";
import { FollowButton } from "@/components/buttons";
import { Loading } from "@/components/loading";
import { ProfileBio } from "@/components/profile-bio";
import { FeedList } from "@/components/feed-list";
import { requireViewer } from "@/lib/auth/viewer";
import { chatLink } from "@/lib/chat";
import { monthYear } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { BIO_MAX } from "@/lib/limits";
import { feedPage, followInfo, getUserByHandle, ServiceError } from "@/lib/services";

async function Profile({ params, searchParams }: PageProps<"/u/[handle]">) {
  await connection();
  const handle = decodeURIComponent((await params).handle);
  const user = await getUserByHandle(handle);
  if (!user) return <p className="p-8 text-center text-muted">{he.profile.notFound}</p>;
  const viewerId = (await requireViewer()).id;
  const { cursor } = await searchParams;
  const byAuthor = { view: "latest" as const, authorId: user.id };
  const [info, page] = await Promise.all([
    followInfo(user.id, viewerId),
    feedPage(viewerId, { ...byAuthor, cursor: typeof cursor === "string" ? cursor : null }).catch(
      (e) => {
        if (e instanceof ServiceError) return feedPage(viewerId, byAuthor);
        throw e;
      },
    ),
  ]);

  const chat = chatLink(user.handle);
  return (
    <>
      <section className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{user.displayName}</h2>
            <p className="text-muted">
              <span dir="ltr">@{user.handle}</span>
            </p>
          </div>
          {viewerId !== user.id && (
            <div className="flex items-center gap-2">
              {chat && (
                <a
                  href={chat}
                  aria-label={he.profile.message}
                  title={he.profile.message}
                  className="grid size-9 place-items-center rounded-full border border-neutral-400 transition-colors hover:bg-neutral-500/15"
                >
                  {/* Chat bubble with typing dots: a conversation, not a comment */}
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden
                    className="size-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  >
                    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
                    <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                    <circle cx="12" cy="11" r="0.75" fill="currentColor" />
                    <circle cx="16" cy="11" r="0.75" fill="currentColor" />
                  </svg>
                </a>
              )}
              <FollowButton userId={user.id} following={info.viewerFollows} />
            </div>
          )}
        </div>
        <ProfileBio bio={user.bio} isSelf={viewerId === user.id} max={BIO_MAX} />
        <p className="mt-2 flex items-center gap-1 text-sm text-muted">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          {he.profile.joined(monthYear(user.createdAt))}
        </p>
        <div className="mt-3 flex gap-4 text-sm text-muted">
          <span>
            <b className="text-foreground">{info.followers}</b> {he.profile.followers}
          </span>
          <span>
            <b className="text-foreground">{info.following}</b> {he.profile.following}
          </span>
        </div>
      </section>
      <FeedList
        key={user.id}
        view="latest"
        author={user.id}
        viewerId={viewerId}
        first={page.items}
        next={page.next}
        asOf={page.asOf}
      />
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
