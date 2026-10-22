// Your saved posts and comments (bookmarks, private), and what you liked: two tabs (?tab=liked).
import { connection } from "next/server";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ItemList, LinkTabs } from "@/components/item-list";
import { Loading } from "@/components/loading";
import { requireViewer, viewerCard } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { likedPage, savedPage } from "@/lib/services";

async function Saved({ searchParams }: PageProps<"/saved">) {
  await connection();
  const viewer = await viewerCard(await requireViewer());
  const sp = await searchParams;
  const liked = sp.tab === "liked";
  const cursor = typeof sp.cursor === "string" ? sp.cursor : null;
  const page = await (liked ? likedPage : savedPage)(viewer.id, cursor);
  const base = liked ? "/saved?tab=liked&" : "/saved?";
  return (
    <>
      <LinkTabs
        tabs={[
          { href: "/saved", label: he.bookmarks.saved, current: !liked },
          { href: "/saved?tab=liked", label: he.bookmarks.liked, current: liked },
        ]}
      />
      <ItemList
        items={page.items}
        next={page.next}
        viewer={viewer}
        empty={liked ? he.bookmarks.noLiked : he.bookmarks.noSaved}
        href={(c) => `${base}cursor=${encodeURIComponent(c)}`}
      />
    </>
  );
}

export const metadata: Metadata = { title: he.bookmarks.title };

export default function Page(props: PageProps<"/saved">) {
  return (
    <Suspense fallback={<Loading />}>
      <Saved {...props} />
    </Suspense>
  );
}
