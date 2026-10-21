"use client";
// @mention autocomplete for the composer (docs/notifications.md): typing "@" and a few letters
// suggests people; ↑/↓ choose, Enter or Tab inserts "@handle ", Esc closes.
import { useEffect, useId, useState, type RefObject } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { mentionSuggestionsAction, type MentionSuggestion } from "@/app/actions";

// The partial mention right before the caret (same rule as lib/mentions.ts, without a minimum).
const PARTIAL = /(^|[^\p{L}\p{N}_@.])@([a-zA-Z][a-zA-Z0-9_]{0,14})$/u;

const LIST_WIDTH = 288; // w-72

/** Just under the caret at `pos`, its inline start at the caret, kept inside the editor box (the
 * list's positioned parent). The caret, not the "@": a neutral "@" between Hebrew and Latin text
 * measures unreliably, and the caret is where the eye is. */
function anchor(view: EditorView, pos: number) {
  const box = (view.dom.offsetParent ?? view.dom).getBoundingClientRect();
  const at = view.coordsAtPos(pos);
  // The paragraph's own direction: an English one in a Hebrew post opens the list the other way.
  const at0 = view.domAtPos(pos).node;
  const block = at0 instanceof Element ? at0 : (at0.parentElement ?? view.dom);
  const rtl = getComputedStyle(block).direction === "rtl";
  const start = rtl ? box.right - at.left : at.left - box.left;
  return {
    top: at.bottom - box.top + 4,
    start: Math.max(0, Math.min(start, box.width - LIST_WIDTH)),
  };
}

export function useMentionSuggest(view: RefObject<EditorView | null>) {
  const listId = useId();
  // from/to: the "@partial" in the document, replaced on pick. top/start: where the list opens,
  // under the caret (px from the editor box's top and inline start).
  const [query, setQuery] = useState<{
    q: string;
    from: number;
    to: number;
    top: number;
    start: number;
  } | null>(null);
  const [items, setItems] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);

  // What is being typed at the caret (after every edit and caret move). Code doesn't mention.
  const track = (state: EditorState) => {
    const { empty, $from } = state.selection;
    const code = $from.parent.type.spec.code || state.schema.marks.code.isInSet($from.marks());
    if (!empty || code) return setQuery(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    const m = before.match(PARTIAL);
    const v = view.current;
    if (!m || !v) return setQuery(null);
    setQuery({
      q: m[2],
      from: $from.pos - m[2].length - 1,
      to: $from.pos,
      ...anchor(v, $from.pos),
    });
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

  const list =
    open && query ? (
      <ul
        id={listId}
        role="listbox"
        style={{ top: query.top, insetInlineStart: query.start }}
        className="absolute z-30 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-background py-1 text-start shadow-lg dark:border-neutral-800"
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
