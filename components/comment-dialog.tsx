"use client";
// The feed card's comment button: comment in a popup (like "edit profile", components/
// profile-editor.tsx) instead of leaving the feed. Native <dialog>: focus stays inside, Esc and a
// click outside close it. Closing keeps the draft (shared with the post page's comment box); the
// editor's cancel button drops it.
import { useRef, useState } from "react";
import { createCommentAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { Markdown } from "@/components/markdown";
import { he } from "@/lib/i18n/he";
import { COMMENT_MAX } from "@/lib/limits";

export function CommentButton(p: {
  postId: string;
  count: number;
  author: { displayName: string; handle: string };
  preview: string;
  viewer?: { displayName: string; handle: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0); // remount the editor on each open: it takes the caret
  const close = () => dialog.current?.close();
  // Comments sent from here count at once; a fresh count from the server replaces the guess.
  const [sent, setSent] = useState(0);
  const [base, setBase] = useState(p.count);
  if (base !== p.count) {
    setBase(p.count);
    setSent(0);
  }
  const count = p.count + sent;
  const titleId = `comment-title-${p.postId}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
        aria-label={`${count} ${he.post.comments}`}
        title={he.comment.add}
        className="group -my-1 -ms-2 flex items-center tabular-nums transition-colors hover:text-sky-500"
      >
        <span className="grid size-8 place-items-center rounded-full transition-colors group-hover:bg-sky-500/10 group-focus-visible:bg-sky-500/10">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
          >
            <path d="M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1 0-1.96-.13-2.86-.38L4.5 20.5l1.2-3.6C4.03 15.55 3 13.62 3 11.5 3 7.36 7.03 4 12 4Z" />
          </svg>
        </span>
        <span className="min-w-[1ch] text-sm">{count > 0 ? count : ""}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        // Click on the backdrop (outside the panel) closes it.
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] cursor-auto rounded-2xl bg-background p-0 text-start text-base font-normal text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id={titleId} className="text-xl font-bold">
              {he.comment.add}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={he.comment.close}
              title={he.comment.close}
              className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {/* What you're answering: who, and the start of the post. */}
          <div className="rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
            <div className="flex min-w-0 items-baseline gap-x-2">
              <span className="truncate font-bold">{p.author.displayName}</span>
              <span className="shrink-[3] truncate text-muted" dir="ltr">
                @{p.author.handle}
              </span>
            </div>
            {/* The feed excerpt (already short); an unusually tall one scrolls, no fade. */}
            <div className="max-h-48 overflow-y-auto text-muted">
              <Markdown text={p.preview} />
            </div>
          </div>
          {open > 0 && (
            <Composer
              key={open}
              action={createCommentAction}
              hidden={{ postId: p.postId }}
              draft={`comment:${p.postId}`}
              autoFocus
              author={p.viewer}
              max={COMMENT_MAX}
              rows={3}
              placeholder={he.comment.placeholder}
              submitLabel={he.comment.send}
              onCancel={close}
              onDone={() => {
                setSent((n) => n + 1);
                close();
              }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
