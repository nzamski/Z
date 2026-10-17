import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { createPostAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { Loading } from "@/components/loading";
import { requireViewer } from "@/lib/auth/viewer";
import { parseView, type FeedView } from "@/lib/feed";
import { he } from "@/lib/i18n/he";
import { feedPage, ServiceError } from "@/lib/services";

const tabs: [FeedView, string][] = [
  ["forYou", he.nav.forYou],
  ["following", he.nav.following],
  ["latest", he.nav.latest],
];

async function Home({ searchParams }: PageProps<"/">) {
  await connection();
  const q = await searchParams;
  const view = parseView(q.view);
  const viewerId = (await requireViewer()).id;
  // `cursor` is the no-JS "load more" link; a garbled one just starts over.
  const cursor = typeof q.cursor === "string" ? q.cursor : null;
  const page = await feedPage(viewerId, { view, cursor }).catch((e) => {
    if (e instanceof ServiceError) return feedPage(viewerId, { view });
    throw e;
  });
  return (
    <>
      <nav className="flex gap-6 border-b border-neutral-200 px-4 pt-3 text-sm font-medium dark:border-neutral-800">
        {tabs.map(([v, label]) => (
          <Link
            key={v}
            href={v === "forYou" ? "/" : `/?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className="border-b-2 border-transparent pb-2 text-neutral-500 aria-[current]:border-current aria-[current]:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        <Composer
          action={createPostAction}
          max={20_000}
          placeholder={he.composer.placeholder}
          submitLabel={he.composer.publish}
        />
      </div>
      <FeedList key={view} params={{ view }} first={page.items} next={page.next} />
    </>
  );
}

export default function Page(props: PageProps<"/">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Home {...props} />
      </Suspense>
    </main>
  );
}
