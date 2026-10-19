import { Suspense } from "react";
import { LikersPage } from "@/components/likers-page";
import { ListSkeleton } from "@/components/loading";
import { he } from "@/lib/i18n/he";
import type { Metadata } from "next";

export const metadata: Metadata = { title: he.likers.title };

export default function Page(props: PageProps<"/c/[id]/likes">) {
  return (
    <main>
      <Suspense fallback={<ListSkeleton />}>
        <LikersPage params={props.params} searchParams={props.searchParams} kind="comment" />
      </Suspense>
    </main>
  );
}
