import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Loading } from "@/components/loading";
import { Thread } from "@/components/thread";
import { requireViewer } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { getComment, getPost, getThread, getUser, isAdmin, REPLIES_PAGE } from "@/lib/services";
import type { Metadata } from "next";
import { snippet } from "@/lib/format";

// One comment's subthread: target of "continue thread" (depth cap) and "show N more replies".
async function CommentPage({ params, searchParams }: PageProps<"/c/[id]">) {
  await connection();
  const { id } = await params;
  const from = Math.max(0, Number((await searchParams).from) || 0);
  const notFound = <p className="p-8 text-center text-muted">{he.errors.not_found}</p>;
  if (!z.uuid().safeParse(id).success) return notFound;
  const comment = await getComment(id);
  if (!comment) return notFound;
  const viewerId = (await requireViewer()).id;
  const post = await getPost(comment.postId, viewerId);
  if (!post || post.deletedAt)
    return (
      <p className="p-8 text-center text-muted">
        {post?.removedAt ? he.post.removedPage : he.post.deletedPage}
      </p>
    );

  // The comment alone, then a page of its replies (each with its own subtree) underneath.
  const [self] = (await getThread(post.id, comment.parentCommentId, 0, id)).nodes;
  if (!self) return notFound;
  const replies = await getThread(post.id, id, from);
  const ctx = { postId: post.id, viewerId, postLive: true, isAdmin: await isAdmin(viewerId) };

  return (
    <section className="p-4 text-start">
      <Link href={`/p/${post.id}`} className="text-sm text-link hover:underline">
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
            className="mt-4 inline-block text-sm text-link hover:underline"
          >
            {he.comment.showMore(replies.total - from - REPLIES_PAGE)}
          </a>
        )}
      </div>
    </section>
  );
}

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await params;
  const comment = z.uuid().safeParse(id).success ? await getComment(id) : null;
  const author = comment && !comment.deletedAt ? await getUser(comment.authorId) : null;
  if (!comment || !author) return { title: he.errors.not_found };
  return { title: he.titles.post(author.displayName, snippet(comment.body)) };
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
