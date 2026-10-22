import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { createCommentAction, restorePostAction } from "@/app/actions";
import { BookmarkButton, LikeButton } from "@/components/buttons";
import { Composer } from "@/components/composer";
import { Loading } from "@/components/loading";
import { ModerateButton } from "@/components/moderate-button";
import { Markdown } from "@/components/markdown";
import { Avatar } from "@/components/avatar";
import { CommentButton } from "@/components/comment-dialog";
import { Byline } from "@/components/post-card";
import { Poll } from "@/components/poll";
import { PostDetail } from "@/components/post-detail";
import { Thread } from "@/components/thread";
import { canSeeContent, requireViewer, viewerCard } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { COMMENT_MAX } from "@/lib/limits";
import { canEditPost, getPost, getThread, isAdmin, ROOTS_PAGE } from "@/lib/services";
import type { Metadata } from "next";
import { snippet } from "@/lib/format";

const Notice = ({ text }: { text: string }) => <p className="p-8 text-center text-muted">{text}</p>;

async function PostPage({ params, searchParams }: PageProps<"/p/[id]">) {
  await connection();
  const { id } = await params;
  const q = await searchParams;
  const from = Math.max(0, Number(q.from) || 0);
  if (!z.uuid().safeParse(id).success) return <Notice text={he.post.notFound} />;
  const me = await requireViewer();
  const viewer = await viewerCard(me);
  const viewerId = viewer.id;
  const post = await getPost(id, viewerId);
  if (!post) return <Notice text={he.post.notFound} />;
  const admin = await isAdmin(viewerId);
  if (post.removedAt && admin) return <RemovedPost post={post} />;
  if (post.deletedAt)
    return <Notice text={post.removedAt ? he.post.removedPage : he.post.deletedPage} />;

  const thread = await getThread(post.id, null, from, undefined, viewerId);
  const body = <Markdown text={post.body} className="mt-2 text-lg" />;
  return (
    <>
      <article className="flex gap-3 border-b border-neutral-200 p-4 text-start dark:border-neutral-800">
        <Avatar name={post.author.displayName} handle={post.author.handle} />
        <div className="min-w-0 flex-1">
          <PostDetail
            post={post}
            viewer={viewer}
            byline={
              <Byline author={post.author} createdAt={post.createdAt} editedAt={post.editedAt} />
            }
            startEditing={q.edit === "1" && canEditPost(post.createdAt)} // from a card's "⋯" menu
          >
            {body}
          </PostDetail>
          {post.poll && (
            <Poll postId={post.id} poll={post.poll} canVote={viewerId !== post.authorId} />
          )}
          <div className="mt-3 flex gap-8 text-sm text-muted">
            <LikeButton
              id={post.id}
              liked={post.liked}
              count={post.likeCount}
              likersHref={`/p/${post.id}/likes`}
            />
            <CommentButton
              postId={post.id}
              count={post.commentCount}
              author={post.author}
              preview={post.body}
              viewer={viewer}
            />
            <div className="ms-auto">
              <BookmarkButton id={post.id} kind="post" saved={post.bookmarked} />
            </div>
          </div>
        </div>
      </article>
      <section id="reply" className="scroll-mt-24 p-4 text-start">
        {viewerId ? (
          <Composer
            action={createCommentAction}
            hidden={{ postId: post.id }}
            draft={`comment:${post.id}`}
            focusOn="reply"
            author={viewer}
            max={COMMENT_MAX}
            rows={2}
            placeholder={he.comment.placeholder}
            submitLabel={he.comment.send}
          />
        ) : null}
        <div className="mt-4">
          <Thread
            nodes={thread.nodes}
            ctx={{ postId: post.id, viewerId, viewer, postLive: true, isAdmin: admin }}
          />
          {from + ROOTS_PAGE < thread.total && (
            <a
              href={`/p/${post.id}?from=${from + ROOTS_PAGE}`}
              className="mt-4 inline-block text-sm text-link hover:underline"
            >
              {he.comment.showMore(thread.total - from - ROOTS_PAGE)}
            </a>
          )}
        </div>
      </section>
    </>
  );
}

/** What a moderator removed, shown to admins only, so they can review and restore it. */
function RemovedPost({ post }: { post: NonNullable<Awaited<ReturnType<typeof getPost>>> }) {
  return (
    <article className="space-y-3 p-4 text-start">
      <p className="text-muted">{he.post.removedPage}</p>
      <div className="rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
        <p className="mb-2 text-sm text-muted">{he.moderation.removedBody}</p>
        <Byline author={post.author} createdAt={post.createdAt} editedAt={post.editedAt} />
        <Markdown text={post.body} className="mt-2" />
      </div>
      <div className="text-sm text-muted">
        <ModerateButton
          label={he.moderation.restore}
          action={restorePostAction.bind(null, post.id)}
        />
      </div>
    </article>
  );
}

// X-style: "Name ב־Z: "first words of the post"". The proxy already required a session.
export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  if (!(await canSeeContent())) return { title: { absolute: he.appName } };
  const { id } = await params;
  const post = z.uuid().safeParse(id).success ? await getPost(id, null) : null;
  if (!post) return { title: he.post.notFound };
  if (post.deletedAt) return { title: post.removedAt ? he.post.removedPage : he.post.deletedPage };
  return { title: he.titles.post(post.author.displayName, snippet(post.body)) };
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
