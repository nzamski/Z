"use client";
// Plain-text composer (markdown is off for now) with a character counter.
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";

type Props = {
  action: (prev: ActionResult, f: FormData) => Promise<ActionResult>;
  hidden?: Record<string, string>;
  initial?: string;
  max: number;
  placeholder: string;
  submitLabel: string;
  rows?: number;
  onCancel?: () => void;
  onDone?: () => void;
  allowEmpty?: boolean; // e.g. clearing a bio
};

export function Composer(p: Props) {
  const [body, setBody] = useState(p.initial ?? "");
  const textarea = useRef<HTMLTextAreaElement>(null);
  // Keep anything typed before hydration (slow loads), which React state would otherwise miss.
  useEffect(() => {
    const typed = textarea.current?.value;
    if (typed && typed !== p.initial) setBody(typed);
  }, [p.initial]);
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, f: FormData) => {
    const r = await p.action(prev, f);
    if (r.ok) {
      setBody(p.initial ?? "");
      p.onDone?.();
    }
    return r;
  }, {});
  const over = body.length > p.max;

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(p.hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <textarea
        ref={textarea}
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={p.placeholder}
        rows={p.rows ?? 4}
        className="w-full resize-y rounded-md border border-neutral-300 bg-transparent p-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
      />
      <div className="flex items-center gap-3 text-sm">
        <button
          disabled={pending || over || (!p.allowEmpty && !body.trim())}
          className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
        >
          {p.submitLabel}
        </button>
        {p.onCancel && (
          <button
            type="button"
            onClick={p.onCancel}
            className="text-neutral-500 hover:text-foreground hover:underline"
          >
            {he.composer.cancel}
          </button>
        )}
        <span className={over ? "text-red-600" : "text-neutral-500"} dir="ltr">
          {body.length.toLocaleString()} / {p.max.toLocaleString()}
        </span>
        {over && <span className="text-red-600">{he.composer.tooLong}</span>}
        {state.error && (
          <span role="alert" className="text-red-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
