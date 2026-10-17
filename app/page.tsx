import { connection } from "next/server";
import { Suspense } from "react";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";
import { latestPosts } from "@/lib/services";

const tabs = [he.nav.forYou, he.nav.following, he.nav.latest];
const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return rtf.format(-min, "minute");
  if (min < 24 * 60) return rtf.format(-Math.round(min / 60), "hour");
  return rtf.format(-Math.round(min / (24 * 60)), "day");
}

async function Feed() {
  await connection();
  const posts = await latestPosts();
  if (!posts.length) return <p className="p-4 text-start text-neutral-500">{he.feed.empty}</p>;
  return (
    <ul>
      {posts.map((p) => (
        <li
          key={p.id}
          className="border-b border-neutral-200 px-4 py-4 text-start dark:border-neutral-800"
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-bold">{p.author.displayName}</span>
            <span className="text-neutral-500" dir="ltr">
              @{p.author.handle}
            </span>
            <span className="text-neutral-500">· {p.author.unit}</span>
            <span className="text-neutral-500">· {ago(p.createdAt)}</span>
            {p.editedAt && <span className="text-neutral-500">· {he.post.edited}</span>}
          </div>
          {/* Safe: markdown-it runs with html disabled (lib/markdown.ts). */}
          <div
            className="md mt-1"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(p.preview) }}
          />
          {p.hasMore && <p className="mt-1 text-sm text-neutral-500">{he.post.readMore}…</p>}
          <div className="mt-2 flex gap-6 text-sm text-neutral-500">
            <span>
              {p.likeCount} {he.post.likes}
            </span>
            <span>
              {p.commentCount} {he.post.comments}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 border-x border-neutral-200 dark:border-neutral-800">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-background/90 px-4 py-3 backdrop-blur dark:border-neutral-800">
        <h1 className="text-center">
          <span className="text-5xl font-bold select-none">{he.appName}</span>
        </h1>
        <nav className="mt-3 flex gap-6 text-sm font-medium">
          {tabs.map((t) => (
            <span key={t} className="pb-1 first:border-b-2 first:border-current">
              {t}
            </span>
          ))}
        </nav>
      </header>
      <Suspense fallback={<p className="p-4 text-start text-neutral-500">{he.feed.loading}</p>}>
        <Feed />
      </Suspense>
    </main>
  );
}
