// A #topic (docs/topics.md): its posts, newest first or most liked, and a follow button.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { FollowButton } from "@/components/buttons";
import { FeedList } from "@/components/feed-list";
import { Loading } from "@/components/loading";
import { canSeeContent, requireViewer, viewerCard } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { feedPage, ServiceError, topicInfo } from "@/lib/services";
import { isTag, normalizeTag, tagHref } from "@/lib/tags";

const tagOf = async (params: PageProps<"/t/[tag]">["params"]) =>
  normalizeTag(decodeURIComponent((await params).tag));

async function Topic({ params, searchParams }: PageProps<"/t/[tag]">) {
  await connection();
  const tag = await tagOf(params);
  if (!isTag(tag)) return <p className="p-8 text-center text-muted">{he.topics.invalid}</p>;
  const viewer = viewerCard(await requireViewer());
  const q = await searchParams;
  const view = q.sort === "top" ? "top" : "latest";
  const cursor = typeof q.cursor === "string" ? q.cursor : null;
  const opts = { view, tag } as const;
  const [info, page] = await Promise.all([
    topicInfo(viewer.id, tag),
    feedPage(viewer.id, { ...opts, cursor }).catch((e) => {
      if (e instanceof ServiceError) return feedPage(viewer.id, opts); // a garbled cursor
      throw e;
    }),
  ]);
  const sorts = [
    ["latest", he.topics.newest],
    ["top", he.topics.top],
  ] as const;
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 pt-3 text-start dark:border-neutral-800">
        <div className="min-w-0 pb-1">
          <h1 className="truncate text-xl font-bold" dir="auto">
            #{tag}
          </h1>
          <p className="text-sm text-muted">{he.topics.posts(info.posts)}</p>
        </div>
        <FollowButton topic={tag} following={info.following} />
      </div>
      <nav
        aria-label={he.topics.sort}
        className="flex border-b border-neutral-200 text-sm font-medium dark:border-neutral-800"
      >
        {sorts.map(([v, label]) => (
          <Link
            key={v}
            href={v === "top" ? `${tagHref(tag)}?sort=top` : tagHref(tag)}
            aria-current={v === view ? "page" : undefined}
            className="group flex flex-1 justify-center pt-2 text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-[current=page]:text-foreground"
          >
            <span className="border-b-2 border-transparent px-1 pb-2 group-aria-[current=page]:border-current">
              {label}
            </span>
          </Link>
        ))}
      </nav>
      <FeedList
        key={view}
        view={view}
        tag={tag}
        viewer={viewer}
        emptyText={he.topics.empty}
        first={page.items}
        next={page.next}
        asOf={page.asOf}
      />
    </>
  );
}

export async function generateMetadata({ params }: PageProps<"/t/[tag]">): Promise<Metadata> {
  if (!(await canSeeContent())) return { title: { absolute: he.appName } };
  return { title: `#${await tagOf(params)}` };
}

export default function Page(props: PageProps<"/t/[tag]">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Topic {...props} />
      </Suspense>
    </main>
  );
}
