"use client";
// A moderator action with a required reason (it goes into the audit log). Click → inline reason
// field → confirm. The server checks that the viewer is an admin; this is only the control.
import { useId, useState, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { REASON_MAX } from "@/lib/limits";

export function ModerateButton(p: {
  label: string;
  action: (reason: string) => Promise<ActionResult>;
  danger?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const id = useId();
  const tone = p.danger ? "hover:text-danger" : "hover:text-foreground";
  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className={`transition-colors hover:underline ${tone}`}
      >
        {p.label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await p.action(reason);
          setError(r.error);
          if (r.ok) {
            setArmed(false);
            setReason("");
          }
        });
      }}
    >
      <label htmlFor={id} className="sr-only">
        {he.moderation.reason}
      </label>
      <input
        id={id}
        autoFocus
        required
        maxLength={REASON_MAX}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={he.moderation.reason}
        className="min-w-48 flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-foreground outline-none focus:border-sky-500 dark:border-neutral-700"
      />
      <button
        disabled={pending || !reason.trim()}
        className={`font-medium hover:underline disabled:opacity-50 ${p.danger ? "text-danger" : "text-foreground"}`}
      >
        {p.label}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="transition-colors hover:text-foreground hover:underline"
      >
        {he.composer.cancel}
      </button>
      {error && <span className="text-danger">{error}</span>}
    </form>
  );
}
