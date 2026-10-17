"use client";
// Markdown composer with a live preview from the same renderer the server uses.
import { useActionState, useState } from "react";
import type { ActionResult } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";

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
};

export function Composer(p: Props) {
  const [body, setBody] = useState(p.initial ?? "");
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

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(p.hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="flex gap-4 text-sm">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "font-bold underline" : "text-neutral-500"}
          >
            {he.composer[t]}
          </button>
        ))}
      </div>
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={p.placeholder}
        rows={p.rows ?? 4}
        hidden={tab !== "write"}
        className="w-full resize-y rounded-md border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
      />
      {tab === "preview" && (
        <div
          className="md min-h-16 rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700"
          // Safe: markdown-it with html disabled (lib/markdown.ts).
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}
      <div className="flex items-center gap-3 text-sm">
        <button
          disabled={pending || over || !body.trim()}
          className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background disabled:opacity-40"
        >
          {p.submitLabel}
        </button>
        {p.onCancel && (
          <button type="button" onClick={p.onCancel} className="text-neutral-500">
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
