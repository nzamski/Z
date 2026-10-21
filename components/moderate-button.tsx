"use client";
// A moderator action with a required reason (it goes into the audit log), confirmed in a popup
// like the delete one (components/buttons.tsx): native <dialog>, Esc or a click outside cancels.
// The server checks that the viewer is an admin; this is only the control.
import { useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { REASON_MAX } from "@/lib/limits";

export function ModerateButton(p: {
  label: string;
  action: (reason: string) => Promise<ActionResult>;
  danger?: boolean;
  triggerClass?: string; // e.g. as an item in a post's "⋯" menu
  onDone?: () => void; // after the action succeeded
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const id = useId();
  const close = () => dialog.current?.close();
  const tone = p.danger ? "hover:text-danger" : "hover:text-foreground";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          dialog.current?.showModal();
        }}
        className={p.triggerClass ?? `transition-colors hover:underline ${tone}`}
      >
        {p.label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] cursor-auto rounded-2xl bg-background p-0 text-start text-base font-normal text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <form
          className="space-y-3 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await p.action(reason);
              setError(r.error);
              if (r.ok) {
                setReason("");
                close();
                p.onDone?.();
              }
            });
          }}
        >
          <h2 id={`${id}-title`} className="text-xl font-bold">
            {p.label}
          </h2>
          <label htmlFor={id} className="block text-sm text-muted">
            {he.moderation.reason}
          </label>
          <textarea
            id={id}
            autoFocus
            required
            rows={2}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="block w-full resize-none rounded-xl border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
          />
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              disabled={pending || !reason.trim()}
              className={`flex-1 rounded-full py-2 font-medium transition-opacity enabled:hover:opacity-90 disabled:opacity-50 ${p.danger ? "bg-red-600 text-white" : "bg-foreground text-background"}`}
            >
              {p.label}
            </button>
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-full border border-neutral-400 py-2 font-medium transition-colors hover:bg-neutral-500/10"
            >
              {he.composer.cancel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
