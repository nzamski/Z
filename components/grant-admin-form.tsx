"use client";
import { useActionState } from "react";
import { grantAdminAction, type ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { HANDLE_MAX, REASON_MAX } from "@/lib/limits";

const input =
  "rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 outline-none focus:border-sky-500 dark:border-neutral-700";

/** Grant admin by handle, with a reason for the log. */
export function GrantAdminForm() {
  const [state, action, pending] = useActionState(grantAdminAction, {} as ActionResult);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
      <input
        name="handle"
        required
        maxLength={HANDLE_MAX + 1}
        placeholder={`@${he.moderation.handle}`}
        aria-label={he.moderation.handle}
        dir="ltr"
        className={`w-40 ${input}`}
      />
      <input
        name="reason"
        required
        maxLength={REASON_MAX}
        placeholder={he.moderation.reason}
        aria-label={he.moderation.reason}
        className={`min-w-48 flex-1 ${input}`}
      />
      <button
        disabled={pending}
        className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50"
      >
        {he.moderation.grant}
      </button>
      {state.error && <span className="w-full text-danger">{state.error}</span>}
    </form>
  );
}
