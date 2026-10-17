import { Suspense } from "react";
import { FollowListPage } from "@/components/follow-list-page";
import { ListSkeleton } from "@/components/loading";

export default function Page(props: PageProps<"/u/[handle]/followers">) {
  return (
    <main>
      <Suspense fallback={<ListSkeleton />}>
        <FollowListPage handle={props.params} searchParams={props.searchParams} which="followers" />
      </Suspense>
    </main>
  );
}
