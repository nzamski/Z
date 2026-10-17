"use client";
// Plain-text composer (markdown is off for now) with a character counter.
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
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

  // Grow with the text instead of a manual resize handle (rows is the minimum height).
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [body]);

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
        className="block w-full resize-none overflow-hidden rounded-md border border-neutral-300 bg-transparent p-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400"
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
        <LengthRing length={body.length} max={p.max} />
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

/** X-style counter: a ring that fills as you type; the numbers appear only near the limit. */
function LengthRing({ length, max }: { length: number; max: number }) {
  if (!length) return null;
  const R = 9;
  const C = 2 * Math.PI * R;
  const near = length >= max * 0.9;
  const over = length > max;
  const color = over ? "text-red-600" : near ? "text-amber-500" : "text-sky-500";
  return (
    <span className="flex items-center gap-2" dir="ltr">
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r={R}
          fill="none"
          strokeWidth={2}
          className="stroke-neutral-300 dark:stroke-neutral-700"
        />
        <circle
          cx="12"
          cy="12"
          r={R}
          fill="none"
          strokeWidth={2}
          stroke="currentColor"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(length / max, 1))}
          strokeLinecap="round"
          className={`${color} transition-[stroke-dashoffset]`}
        />
      </svg>
      {near && (
        <span className={over ? "text-red-600" : "text-neutral-500"}>
          {length.toLocaleString()} / {max.toLocaleString()}
        </span>
      )}
      {!near && (
        <span className="sr-only">
          {length} / {max}
        </span>
      )}
    </span>
  );
}
