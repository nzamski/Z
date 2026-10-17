import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { createCommentAction } from "@/app/actions";
import { LikeButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { Loading } from "@/components/loading";
import { Byline } from "@/components/post-card";
import { PostOwnerActions } from "@/components/post-owner-actions";
import { Thread } from "@/components/thread";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";
import { getPost, getThread, ROOTS_PAGE } from "@/lib/services";

const Notice = ({ text }: { text: string }) => (
  <p className="p-8 text-center text-neutral-500">{text}</p>
);

async function PostPage({ params, searchParams }: PageProps<"/p/[id]">) {
  await connection();
  const { id } = await params;
  const from = Math.max(0, Number((await searchParams).from) || 0);
  if (!z.uuid().safeParse(id).success) return <Notice text={he.post.notFound} />;
  const viewerId = (await getSession())?.uid ?? null;
  const post = await getPost(id, viewerId);
  if (!post) return <Notice text={he.post.notFound} />;
  if (post.deletedAt) return <Notice text={he.post.deletedPage} />;

  const thread = await getThread(post.id, null, from);
  // Safe: markdown-it runs with html disabled (lib/markdown.ts).
  const body = (
    <div
      className="md mt-2 text-lg"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
    />
  );
  return (
    <>
      <article className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800">
        <Byline author={post.author} createdAt={post.createdAt} editedAt={post.editedAt} />
        {viewerId === post.authorId ? (
          <PostOwnerActions postId={post.id} body={post.body}>
            {body}
          </PostOwnerActions>
        ) : (
          body
        )}
        <div className="mt-3 flex gap-6 text-sm text-neutral-500">
          <LikeButton
            postId={post.id}
            liked={post.liked}
            count={post.likeCount}
            canLike={!!viewerId}
          />
          <span>
            {post.commentCount} {he.post.comments}
          </span>
        </div>
      </article>
      <section className="p-4 text-start">
        {viewerId ? (
          <Composer
            action={createCommentAction}
            hidden={{ postId: post.id }}
            max={5_000}
            rows={2}
            placeholder={he.comment.placeholder}
            submitLabel={he.comment.send}
          />
        ) : (
          <a href="/auth/login" className="text-sm text-sky-600 hover:underline">
            {he.comment.loginToComment}
          </a>
        )}
        <div className="mt-4">
          <Thread nodes={thread.nodes} ctx={{ postId: post.id, viewerId, postLive: true }} />
          {from + ROOTS_PAGE < thread.total && (
            <a
              href={`/p/${post.id}?from=${from + ROOTS_PAGE}`}
              className="mt-4 inline-block text-sm text-sky-600 hover:underline"
            >
              {he.comment.showMore(thread.total - from - ROOTS_PAGE)}
            </a>
          )}
        </div>
      </section>
    </>
  );
}

export default function Page(props: PageProps<"/p/[id]">) {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <PostPage {...props} />
      </Suspense>
    </main>
  );
}
