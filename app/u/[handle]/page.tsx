import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  clearBioAction,
  resetHandleAction,
  suspendUserAction,
  unsuspendUserAction,
} from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/buttons";
import { Loading } from "@/components/loading";
import { ModerateButton } from "@/components/moderate-button";
import { PlainText } from "@/components/post-card";
import { ProfileEditor } from "@/components/profile-editor";
import { FeedList } from "@/components/feed-list";
import { PostCard } from "@/components/post-card";
import { canSeeContent, requireViewer, viewerCard } from "@/lib/auth/viewer";
import { chatLink } from "@/lib/chat";
import { monthYear } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import {
  feedPage,
  followInfo,
  getUserByHandle,
  isAdmin,
  pinnedPosts,
  ServiceError,
} from "@/lib/services";
import type { Metadata } from "next";

async function Profile({ params, searchParams }: PageProps<"/u/[handle]">) {
  await connection();
  const handle = decodeURIComponent((await params).handle);
  const user = await getUserByHandle(handle);
  if (!user) return <p className="p-8 text-center text-muted">{he.profile.notFound}</p>;
  const viewer = await viewerCard(await requireViewer());
  const viewerId = viewer.id;
  const { cursor } = await searchParams;
  const byAuthor = { view: "latest" as const, authorId: user.id };
  const [info, page, admin, pins] = await Promise.all([
    followInfo(user.id, viewerId),
    feedPage(viewerId, { ...byAuthor, cursor: typeof cursor === "string" ? cursor : null }).catch(
      (e) => {
        if (e instanceof ServiceError) return feedPage(viewerId, byAuthor);
        throw e;
      },
    ),
    isAdmin(viewerId),
    pinnedPosts(viewerId, user.id),
  ]);

  const chat = chatLink(user.handle);
  const base = `/u/${encodeURIComponent(user.handle)}`;
  return (
    <>
      <section className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Avatar name={user.displayName} large />
            <div className="mt-3 flex min-w-0 flex-wrap items-baseline gap-x-2">
              <h2 className="text-xl font-bold">
                {user.displayName}
                {user.suspendedAt && admin && (
                  <span className="ms-2 rounded-full bg-red-500/10 px-2 py-0.5 align-middle text-xs font-medium text-danger">
                    {he.moderation.suspendedBadge}
                  </span>
                )}
              </h2>
              <span className="text-muted" dir="ltr">
                @{user.handle}
              </span>
            </div>
          </div>
          {viewerId === user.id && (
            <ProfileEditor displayName={user.displayName} handle={user.handle} bio={user.bio} />
          )}
          {viewerId !== user.id && (
            <div className="flex items-center gap-2">
              {chat && (
                <a
                  href={chat}
                  aria-label={he.profile.message}
                  data-tip={he.profile.message}
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
        {user.bio && <PlainText text={user.bio} className="mt-2" />}
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
          <Link href={`${base}/following`} className="hover:underline">
            <b className="text-foreground">{info.following}</b> {he.profile.following}
          </Link>
          <Link href={`${base}/followers`} className="hover:underline">
            <b className="text-foreground">{info.followers}</b> {he.profile.followers}
          </Link>
        </div>
        {admin && viewerId !== user.id && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-200 pt-3 text-sm text-muted dark:border-neutral-800">
            <span className="font-medium">{he.moderation.title}:</span>
            {user.suspendedAt ? (
              <ModerateButton
                label={he.moderation.unsuspend}
                action={unsuspendUserAction.bind(null, user.id)}
              />
            ) : (
              <ModerateButton
                label={he.moderation.suspend}
                danger
                action={suspendUserAction.bind(null, user.id)}
              />
            )}
            {user.bio && (
              <ModerateButton
                label={he.moderation.clearBio}
                danger
                action={clearBioAction.bind(null, user.id)}
              />
            )}
            <ModerateButton
              label={he.moderation.resetHandle}
              danger
              action={resetHandleAction.bind(null, user.id)}
            />
          </div>
        )}
      </section>
      {/* Pinned to the top of the profile, and not again below. */}
      {pins.length > 0 && !cursor && (
        <ul>
          {pins.map((post) => (
            <PostCard key={post.id} post={post} viewer={viewer} pinned />
          ))}
        </ul>
      )}
      <FeedList
        key={user.id}
        view="latest"
        author={user.id}
        hide={cursor ? undefined : pins.map((x) => x.id)}
        viewer={viewer}
        first={page.items}
        next={page.next}
        asOf={page.asOf}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  if (!(await canSeeContent())) return { title: { absolute: he.appName } };
  const user = await getUserByHandle(decodeURIComponent((await params).handle));
  return { title: user ? he.titles.profile(user.displayName, user.handle) : he.profile.notFound };
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
