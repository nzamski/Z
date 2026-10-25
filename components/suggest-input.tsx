"use client";
// A role title or unit input that suggests what others already use (experienceSuggestions), so
// one unit is spelled one way and search finds everyone in it (docs/experience.md). A native
// <datalist>: the browser shows and filters it, keyboard and screen readers included.
import { useEffect, useId, useState } from "react";
import { experienceSuggestionsAction } from "@/app/actions";

const DELAY = 150; // ms after the last keystroke

export function SuggestInput(
  p: { kind: "title" | "unit"; value: string } & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "list" | "value"
  >,
) {
  const { kind, ...input } = p;
  const id = useId();
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    const q = p.value.trim();
    if (!q) return;
    let stale = false;
    const t = setTimeout(async () => {
      const found = await experienceSuggestionsAction(kind, q);
      if (!stale) setOptions(found);
    }, DELAY);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [kind, p.value]);
  return (
    <>
      <input {...input} list={id} autoComplete="off" />
      <datalist id={id}>
        {/* Nothing to suggest when the input already holds the only match. */}
        {p.value.trim() &&
          options.filter((o) => o !== p.value).map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  );
}
