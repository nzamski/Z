import { canSeeContent } from "@/lib/auth/viewer";
import { Suspense } from "react";
import { FollowListPage } from "@/components/follow-list-page";
import { ListSkeleton } from "@/components/loading";
import type { Metadata } from "next";
import { he } from "@/lib/i18n/he";
import { getUserByHandle } from "@/lib/services";

export async function generateMetadata({
  params,
}: PageProps<"/u/[handle]/followers">): Promise<Metadata> {
  if (!(await canSeeContent())) return { title: { absolute: he.appName } };
  const user = await getUserByHandle(decodeURIComponent((await params).handle));
  return { title: user ? he.titles.followers(user.displayName, user.handle) : he.profile.notFound };
}

export default function Page(props: PageProps<"/u/[handle]/followers">) {
  return (
    <main>
      <Suspense fallback={<ListSkeleton />}>
        <FollowListPage handle={props.params} searchParams={props.searchParams} which="followers" />
      </Suspense>
    </main>
  );
}
