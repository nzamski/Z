"use client";
// @mention autocomplete for the composer (docs/notifications.md): typing "@" and a few letters
// suggests people; ↑/↓ choose, Enter or Tab inserts "@handle ", Esc closes.
import { useEffect, useId, useState, type RefObject } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { mentionSuggestionsAction, type MentionSuggestion } from "@/app/actions";

// The partial mention right before the caret (same rule as lib/mentions.ts, without a minimum).
const PARTIAL = /(^|[^\p{L}\p{N}_@.])@([a-zA-Z][a-zA-Z0-9_]{0,14})$/u;

export function useMentionSuggest(view: RefObject<EditorView | null>) {
  const listId = useId();
  // from/to: the "@partial" in the document, replaced on pick.
  const [query, setQuery] = useState<{ q: string; from: number; to: number } | null>(null);
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);

  // What is being typed at the caret (after every edit and caret move). Code doesn't mention.
  const track = (state: EditorState) => {
    const { empty, $from } = state.selection;
    const code = $from.parent.type.spec.code || state.schema.marks.code.isInSet($from.marks());
    if (!empty || code) return setQuery(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    const m = before.match(PARTIAL);
    setQuery(m ? { q: m[2], from: $from.pos - m[2].length - 1, to: $from.pos } : null);
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
    const v = view.current;
    if (!v || !query) return;
    v.dispatch(v.state.tr.insertText(`@${u.handle} `, query.from, query.to));
    setQuery(null);
    setItems([]);
    v.focus();
  };

  /** For the editor's handleKeyDown: true when the key was ours. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) return false;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const d = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + d + items.length) % items.length);
    } else if (e.key === "Enter" || e.key === "Tab") pick(items[active]);
    else if (e.key === "Escape") setQuery(null);
    else return false;
    return true;
  };

  // Set on the editable element (a textbox that owns the list).
  const aria = {
    "aria-autocomplete": "list",
    "aria-controls": listId,
    "aria-activedescendant": open ? `${listId}-${active}` : "",
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
            e.preventDefault(); // keep focus in the editor
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

  return { track, onKeyDown, close: () => setQuery(null), aria, list };
}
