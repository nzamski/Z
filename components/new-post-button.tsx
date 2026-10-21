"use client";
// The rail's "new post" button: the composer in a popup (like the comment popup), from any page.
// It shares the home composer's draft, so a post started in either continues in the other.
import { useRef, useState } from "react";
import { createPostAction } from "@/app/actions";
import { Composer } from "@/components/composer";
import { he } from "@/lib/i18n/he";
import { POST_MAX } from "@/lib/limits";

export function NewPostButton(p: {
  viewer: { displayName: string; handle: string };
  icon: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0); // remount the editor on each open: it takes the caret
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
        aria-label={he.nav.newPost}
        data-tip={he.nav.newPost}
        className="mt-3 flex items-center justify-center gap-2 rounded-full bg-foreground p-3 font-bold text-background transition-opacity hover:opacity-85 xl:py-3 xl:after:hidden"
      >
        <span className="xl:hidden">{p.icon}</span>
        <span className="hidden xl:inline">{he.nav.newPost}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="new-post-title"
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl bg-background p-0 text-start text-base font-normal text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="new-post-title" className="text-xl font-bold">
              {he.nav.newPost}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label={he.comment.close}
              data-tip={he.comment.close}
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
          {open > 0 && (
            <Composer
              key={open}
              action={createPostAction}
              draft="post"
              autoFocus
              author={p.viewer}
              max={POST_MAX}
              rows={5}
              placeholder={he.composer.placeholder}
              submitLabel={he.composer.publish}
              onCancel={close}
              onDone={close}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
