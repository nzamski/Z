"use client";
// @mention autocomplete for the composer (docs/notifications.md): typing "@" and a few letters
// suggests people; ↑/↓ choose, Enter or Tab inserts "@handle ", Esc closes.
import { useEffect, useId, useState, type RefObject } from "react";
import { mentionSuggestionsAction, type MentionSuggestion } from "@/app/actions";

// The partial mention right before the caret (same rule as lib/mentions.ts, without a minimum).
const PARTIAL = /(^|[^\p{L}\p{N}_@.])@([a-zA-Z][a-zA-Z0-9_]{0,14})$/u;

export function useMentionSuggest(
  textarea: RefObject<HTMLTextAreaElement | null>,
  body: string,
  setBody: (v: string) => void,
) {
  const listId = useId();
  const [query, setQuery] = useState<{ q: string; start: number } | null>(null);
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);

  // What is being typed at the caret (on every edit and caret move).
  const track = () => {
    const el = textarea.current;
    if (!el || el.selectionStart !== el.selectionEnd) return setQuery(null);
    const m = el.value.slice(0, el.selectionStart).match(PARTIAL);
    setQuery(m ? { q: m[2], start: el.selectionStart - m[2].length - 1 } : null);
  };

  useEffect(() => {
    if (!query?.q) return;
    let stale = false;
    const t = setTimeout(async () => {
      const found = await mentionSuggestionsAction(query.q);
      if (stale) return;
      setItems(found);
      setActive(0);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query?.q]);

  const open = !!query?.q && items.length > 0;

  const pick = (u: MentionSuggestion) => {
    const el = textarea.current;
    if (!el || !query) return;
    const end = el.selectionStart;
    const insert = `@${u.handle} `;
    setBody(body.slice(0, query.start) + insert + body.slice(end));
    setQuery(null);
    setItems([]);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(query.start + insert.length, query.start + insert.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
    }
  };

  const textareaProps = {
    onKeyDown,
    onKeyUp: (e: React.KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) track();
    },
    onClick: track,
    onInput: track,
    onBlur: () => setTimeout(() => setQuery(null), 150), // let a click on a suggestion land
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-expanded": open,
    "aria-controls": listId,
    "aria-activedescendant": open ? `${listId}-${active}` : undefined,
  };

  const list = open ? (
    <ul
      id={listId}
      role="listbox"
      className="absolute start-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-background py-1 text-start shadow-lg dark:border-neutral-800"
    >
      {items.map((u, i) => (
        <li
          key={u.id}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => {
            e.preventDefault(); // keep focus in the textarea
            pick(u);
          }}
          onMouseEnter={() => setActive(i)}
          className="flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm aria-selected:bg-neutral-500/10"
        >
          <span className="truncate font-bold">{u.displayName}</span>
          <span className="shrink-[3] truncate text-muted" dir="ltr">
            @{u.handle}
          </span>
        </li>
      ))}
    </ul>
  ) : null;

  return { textareaProps, list };
}
