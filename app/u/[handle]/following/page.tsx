import { Suspense } from "react";
import { FollowListPage } from "@/components/follow-list-page";
import { ListSkeleton } from "@/components/loading";

export default function Page(props: PageProps<"/u/[handle]/following">) {
  return (
    <main>
      <Suspense fallback={<ListSkeleton />}>
        <FollowListPage handle={props.params} searchParams={props.searchParams} which="following" />
      </Suspense>
    </main>
  );
}
