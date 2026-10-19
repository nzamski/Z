import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { createPostAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { FeedTabs } from "@/components/feed-tabs";
import { Loading } from "@/components/loading";
import { requireViewer } from "@/lib/auth/viewer";
import { parseView, VIEW_COOKIE } from "@/lib/feed";
import { he } from "@/lib/i18n/he";
import { POST_MAX } from "@/lib/limits";
import { feedPage, ServiceError } from "@/lib/services";
import type { Metadata } from "next";

async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const view = parseView((await cookies()).get(VIEW_COOKIE)?.value);
  const viewer = await requireViewer();
  const viewerId = viewer.id;
  // `cursor` is the no-JS "load more" link; a garbled one just starts over.
  const q = await searchParams;
  const cursor = typeof q.cursor === "string" ? q.cursor : null;
  const page = await feedPage(viewerId, { view, cursor }).catch((e) => {
    if (e instanceof ServiceError) return feedPage(viewerId, { view });
    throw e;
  });
  return (
    <>
      <FeedTabs view={view} />
      <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        {viewer.suspendedAt ? (
          <p role="status" className="text-start text-sm text-danger">
            {he.moderation.suspendedBanner}
          </p>
        ) : (
          <Composer
            action={createPostAction}
            max={POST_MAX}
            placeholder={he.composer.placeholder}
            submitLabel={he.composer.publish}
          />
        )}
      </div>
      <FeedList
        key={view}
        view={view}
        viewerId={viewerId}
        first={page.items}
        next={page.next}
        asOf={page.asOf}
      />
    </>
  );
}

// Same segment as the root layout, whose title template only reaches child segments.
export const metadata: Metadata = { title: { absolute: `${he.titles.home} / ${he.appName}` } };

export default function Page(props: PageProps<"/">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Home {...props} />
      </Suspense>
    </main>
  );
}
