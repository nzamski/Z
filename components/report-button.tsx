"use client";
// "Report" in a post's or comment's "⋯" menu (docs/reports.md): a reason and an optional note,
// in a popup like the moderator one (native <dialog>; Esc or a click outside cancels).
import { useId, useRef, useState, useTransition } from "react";
import { reportAction } from "@/app/actions";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports";
import { he } from "@/lib/i18n/he";
import { REPORT_NOTE_MAX } from "@/lib/limits";

const T = he.reports;

export function ReportButton(p: {
  kind: "post" | "comment";
  id: string;
  triggerClass: string;
  icon?: React.ReactNode;
  onDone?: () => void; // closes the menu
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const id = useId();
  const close = () => {
    dialog.current?.close();
    p.onDone?.();
  };
  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setError(undefined);
          setSent(false);
          setReason(null);
          setNote("");
          dialog.current?.showModal();
        }}
        className={p.triggerClass}
      >
        {p.icon}
        {T.report}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] cursor-auto rounded-2xl bg-background p-0 text-start text-base font-normal text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {sent ? (
          <div className="space-y-4 p-5 sm:p-6">
            {/* The title stays: the dialog is named by it (aria-labelledby). */}
            <h2 id={`${id}-title`} className="text-xl font-bold">
              {T.title}
            </h2>
            <p role="status">{T.thanks}</p>
            <button
              type="button"
              autoFocus
              onClick={close}
              className="w-full rounded-full border border-neutral-400 py-2 font-medium transition-colors hover:bg-neutral-500/10"
            >
              {T.close}
            </button>
          </div>
        ) : (
          <form
            className="space-y-3 p-5 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason) return;
              start(async () => {
                const r = await reportAction(p.kind, p.id, reason, note);
                setError(r.error);
                if (r.ok) setSent(true);
              });
            }}
          >
            <h2 id={`${id}-title`} className="text-xl font-bold">
              {T.title}
            </h2>
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm text-muted">{T.why}</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-500/10"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-sky-600"
                  />
                  {T.reasons[r]}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${id}-note`} className="block text-sm text-muted">
              {T.note}
            </label>
            <textarea
              id={`${id}-note`}
              rows={2}
              maxLength={REPORT_NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="block w-full resize-none rounded-xl border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
            />
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-3 pt-1">
              <button
                disabled={pending || !reason}
                className="flex-1 rounded-full bg-foreground py-2 font-medium text-background transition-opacity enabled:hover:opacity-90 disabled:opacity-50"
              >
                {T.send}
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
        )}
      </dialog>
    </>
  );
}
