import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Loading } from "@/components/loading";
import { Thread } from "@/components/thread";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { getComment, getPost, getThread, REPLIES_PAGE } from "@/lib/services";

// One comment's subthread: target of "continue thread" (depth cap) and "show N more replies".
async function CommentPage({ params, searchParams }: PageProps<"/c/[id]">) {
  await connection();
  const { id } = await params;
  const from = Math.max(0, Number((await searchParams).from) || 0);
  const notFound = <p className="p-8 text-center text-neutral-500">{he.errors.not_found}</p>;
  if (!z.uuid().safeParse(id).success) return notFound;
  const comment = await getComment(id);
  if (!comment) return notFound;
  const viewerId = (await requireViewer()).id;
  const post = await getPost(comment.postId, viewerId);
  if (!post || post.deletedAt)
    return <p className="p-8 text-center text-neutral-500">{he.post.deletedPage}</p>;

  // The comment alone, then a page of its replies (each with its own subtree) underneath.
  const [self] = (await getThread(post.id, comment.parentCommentId, 0, id)).nodes;
  if (!self) return notFound;
  const replies = await getThread(post.id, id, from);
  const ctx = { postId: post.id, viewerId, postLive: true };

  return (
    <section className="p-4 text-start">
      <Link href={`/p/${post.id}`} className="text-sm text-sky-600 hover:underline">
        → {he.comment.backToPost}
      </Link>
      <div className="mt-2">
        <Thread nodes={[{ ...self, children: [], childCount: 0 }]} ctx={ctx} />
        <div className="ms-4">
          <Thread nodes={replies.nodes} ctx={ctx} />
        </div>
        {from + REPLIES_PAGE < replies.total && (
          <a
            href={`/c/${id}?from=${from + REPLIES_PAGE}`}
            className="mt-4 inline-block text-sm text-sky-600 hover:underline"
          >
            {he.comment.showMore(replies.total - from - REPLIES_PAGE)}
          </a>
        )}
      </div>
    </section>
  );
}

export default function Page(props: PageProps<"/c/[id]">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <CommentPage {...props} />
      </Suspense>
    </main>
  );
}
