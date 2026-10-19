import Link from "next/link";
import { connection } from "next/server";
import { z } from "zod";
import { UserRow } from "@/components/user-row";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { likers, ServiceError } from "@/lib/services";

/** /p/[id]/likes and /c/[id]/likes: who liked it, newest like first, with follow buttons. */
export async function LikersPage(p: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  kind: "post" | "comment";
}) {
  await connection();
  const { id } = await p.params;
  const viewer = await requireViewer();
  const notFound = <p className="p-8 text-center text-muted">{he.errors.not_found}</p>;
  if (!z.uuid().safeParse(id).success) return notFound;
  const before = z.uuid().safeParse((await p.searchParams).before);
  let page;
  try {
    page = await likers(p.kind, id, viewer.id, before.data);
  } catch (e) {
    if (e instanceof ServiceError) return notFound;
    throw e;
  }
  const back = p.kind === "post" ? `/p/${id}` : `/c/${id}`;
  return (
    <>
      <div className="border-b border-neutral-200 px-4 py-3 text-start dark:border-neutral-800">
        <h1 className="text-lg font-bold">{he.likers.title}</h1>
        <Link href={back} className="text-sm text-link hover:underline">
          → {p.kind === "post" ? he.comment.backToPost : he.likers.backToComment}
        </Link>
      </div>
      {page.items.length ? (
        <ul>
          {page.items.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              viewerFollows={u.viewerFollows}
              isSelf={u.id === viewer.id}
            />
          ))}
        </ul>
      ) : (
        <p className="p-4 text-start text-muted">{he.likers.none}</p>
      )}
      {page.next && (
        <div className="p-4 text-center text-sm">
          <Link href={`?before=${page.next}`} className="text-link hover:underline">
            {he.feed.loadMore}
          </Link>
        </div>
      )}
    </>
  );
}
