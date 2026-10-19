"use client";
// Markdown composer (posts, comments) with a live preview from the server's own renderer and a
// character counter.
import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ActionResult } from "@/app/actions";
import { Markdown } from "@/components/markdown";
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
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [state, formAction, pending] = useActionState(async (prev: ActionResult, f: FormData) => {
    const r = await p.action(prev, f);
    if (r.ok) {
      setBody(p.initial ?? "");
      setTab("write");
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
      {body && (
        <div role="tablist" className="flex gap-4 text-sm">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="text-muted transition-colors hover:text-foreground aria-selected:font-bold aria-selected:text-foreground"
            >
              {he.composer[t]}
            </button>
          ))}
        </div>
      )}
      {tab === "preview" && (
        <div className="min-h-16 rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
          {body.trim() ? (
            <Markdown text={body} />
          ) : (
            <p className="text-muted">{he.composer.previewEmpty}</p>
          )}
        </div>
      )}
      <textarea
        ref={textarea}
        hidden={tab === "preview"}
        title={he.composer.markdownHint}
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
            className="text-muted hover:text-foreground hover:underline"
          >
            {he.composer.cancel}
          </button>
        )}
        <LengthRing length={body.length} max={p.max} />
        {over && <span className="text-danger">{he.composer.tooLong}</span>}
        {state.error && (
          <span role="alert" className="text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/** X-style counter: a ring that fills as you type; the numbers appear only near the limit. */
export function LengthRing(p: { length: number; max: number; alwaysCount?: boolean }) {
  const { length, max } = p;
  if (!length) return null;
  const R = 9;
  const C = 2 * Math.PI * R;
  const near = length >= max * 0.9;
  const showCount = near || p.alwaysCount;
  const over = length > max;
  const color = over ? "text-danger" : near ? "text-amber-500" : "text-sky-500";
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
      {showCount && (
        <span className={over ? "text-danger" : "text-muted"}>
          {length.toLocaleString()} / {max.toLocaleString()}
        </span>
      )}
      {!showCount && (
        <span className="sr-only">
          {length} / {max}
        </span>
      )}
    </span>
  );
}
