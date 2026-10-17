import { connection } from "next/server";
import { Suspense } from "react";
import { FeedList } from "@/components/feed-list";
import { Loading } from "@/components/loading";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { feedPage, ServiceError } from "@/lib/services";

async function Results({ searchParams }: PageProps<"/search">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;
  const viewerId = (await requireViewer()).id;
  return (
    <>
      {/* A plain GET form: works without JS and keeps the query in the URL (shareable). */}
      <form
        action="/search"
        role="search"
        className="sticky top-(--header-h) z-10 border-b border-neutral-200 bg-background/90 p-3 backdrop-blur dark:border-neutral-800"
      >
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          placeholder={he.search.placeholder}
          aria-label={he.nav.search}
          className="w-full rounded-full border border-neutral-300 bg-transparent px-4 py-2 outline-none focus:border-sky-500 dark:border-neutral-700"
        />
      </form>
      {q ? (
        <SearchResults viewerId={viewerId} q={q} cursor={cursor} />
      ) : (
        <p className="p-4 text-start text-muted">{he.search.hint}</p>
      )}
    </>
  );
}

async function SearchResults(p: { viewerId: string; q: string; cursor: string | null }) {
  const opts = { view: "latest" as const, query: p.q };
  const page = await feedPage(p.viewerId, { ...opts, cursor: p.cursor }).catch((e) => {
    if (e instanceof ServiceError) return feedPage(p.viewerId, opts);
    throw e;
  });
  return (
    <FeedList
      key={p.q}
      view="latest"
      q={p.q}
      viewerId={p.viewerId}
      first={page.items}
      next={page.next}
      asOf={page.asOf}
      emptyText={he.search.none(p.q)}
    />
  );
}

export default function Page(props: PageProps<"/search">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Results {...props} />
      </Suspense>
    </main>
  );
}
