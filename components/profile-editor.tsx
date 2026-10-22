"use client";
// "Edit profile" on your own profile, in a modal dialog: handle, bio, profession and avatar (the display name is
// shown read-only: it comes from Keycloak). A new handle moves the page to /u/<new>. Native <dialog>: Esc closes it,
// focus stays inside, the page behind is inert.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ProfileForm } from "@/components/profile-form";
import { he } from "@/lib/i18n/he";

export function ProfileEditor(p: {
  displayName: string;
  handle: string;
  bio: string;
  profession: string | null;
  avatarSeed: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0); // remount the form on each open: fresh fields
  const router = useRouter();
  const close = () => dialog.current?.close();
  return (
    <>
      <button
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
        className="rounded-full border border-neutral-400 px-4 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-500/10"
      >
        {he.profile.edit}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="edit-profile-title"
        // Click on the backdrop (outside the panel) closes it.
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 id="edit-profile-title" className="text-xl font-bold">
              {he.profile.edit}
            </h2>
            <button
              onClick={close}
              aria-label={he.composer.cancel}
              data-tip={he.composer.cancel}
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
            <ProfileForm
              key={open}
              displayName={p.displayName}
              initial={{
                handle: p.handle,
                bio: p.bio,
                profession: p.profession,
                avatarSeed: p.avatarSeed,
              }}
              submitLabel={he.composer.save}
              saveAtEnd
              onSaved={(handle) => {
                close();
                if (handle !== p.handle) router.replace(`/u/${encodeURIComponent(handle)}`);
              }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
