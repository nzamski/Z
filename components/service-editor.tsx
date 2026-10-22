"use client";
// Edit the service details (lib/service-info.ts) in their own popup, like "edit profile" and the
// experience editor: native <dialog> (Esc closes, focus stays inside). Saved on their own.
import { useActionState, useRef, useState } from "react";
import { updateServiceAction } from "@/app/actions";
import { ServiceFields } from "@/components/service-fields";
import { he } from "@/lib/i18n/he";
import type { ServiceInfo } from "@/lib/service-info";

export function ServiceEditor({ initial }: { initial: ServiceInfo }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0); // remount the form on each open: fresh fields
  const close = () => dialog.current?.close();
  const label = he.profile.serviceEdit;
  return (
    <>
      <button
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
        aria-label={label}
        data-tip={label}
        className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        aria-label={label}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 text-start sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{label}</h2>
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
          {open > 0 && <ServiceForm key={open} initial={initial} onDone={close} />}
        </div>
      </dialog>
    </>
  );
}

function ServiceForm({ initial, onDone }: { initial: ServiceInfo; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok?: true; error?: string }, f: FormData) => {
      const r = await updateServiceAction(prev, f);
      if (r.ok) onDone();
      return r;
    },
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <ServiceFields initial={initial} />
      <div className="flex flex-row-reverse items-center justify-start gap-3 text-sm">
        <button
          disabled={pending}
          className="rounded-full bg-foreground px-5 py-2 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
        >
          {he.composer.save}
        </button>
        {state.error && (
          <span role="alert" className="text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
