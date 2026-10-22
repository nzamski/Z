"use client";
// Z's own dropdown (not the browser's <select>): the poll's duration parts and the date picker's
// day, month and year (DatePick) use it, so they look alike.
import { useEffect, useState } from "react";
import { useMenu } from "@/components/theme-menu";

const LIST_H = 200; // px: the list's max-h-48 and its margin

/** A labelled dropdown: `values`, shown through `format` (default: as is); with `name`, also a
 * hidden input for the surrounding form. Fixed to the
 * screen (like the emoji picker), so the new-post popup's edge doesn't cut it off; above the
 * button when there's no room below. */
export function Pick<T extends string | number>(p: {
  label: string;
  value: T;
  values: readonly T[];
  onPick: (v: T) => void;
  format?: (v: T) => React.ReactNode;
  name?: string;
}) {
  const show = p.format ?? ((v: T) => v);
  const { open, setOpen, root } = useMenu();
  const [at, setAt] = useState({ top: 0, left: 0, width: 0 });
  // Fixed to the screen: scrolling the page would leave it behind, so that closes it (scrolling
  // the list itself doesn't).
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("scroll", close, true);
    return () => removeEventListener("scroll", close, true);
  }, [open, root, setOpen]);
  const disabled = p.values.length < 2;
  return (
    <div ref={root} className="relative flex-1">
      {p.name && <input type="hidden" name={p.name} value={p.value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({
            top: innerHeight - r.bottom >= LIST_H ? r.bottom + 4 : r.top - LIST_H,
            left: r.left,
            width: r.width,
          });
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-start transition-colors enabled:hover:border-neutral-400 disabled:opacity-50 aria-expanded:border-sky-500 dark:border-neutral-800 dark:enabled:hover:border-neutral-600 dark:aria-expanded:border-sky-500"
      >
        <span>
          <span className="block text-xs text-muted">{p.label}</span>
          <span className="text-base">{show(p.value)}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={p.label}
          style={at}
          className="fixed z-30 max-h-48 overflow-y-auto rounded-xl border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800"
        >
          {p.values.map((v) => (
            <li key={v}>
              <button
                type="button"
                role="option"
                aria-selected={v === p.value}
                // The chosen one starts in view.
                ref={(el) => void (v === p.value && el?.scrollIntoView({ block: "nearest" }))}
                onClick={() => {
                  p.onPick(v);
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-start transition-colors hover:bg-neutral-500/10 aria-selected:font-bold aria-selected:text-sky-500"
              >
                {show(v)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
