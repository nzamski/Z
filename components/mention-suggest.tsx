"use client";
// Autocomplete for the composer: typing "@" and a few letters of a handle or a display name
// suggests people (docs/notifications.md), "#" suggests existing topics, most used first (docs/topics.md). ↑/↓ choose,
// Enter or Tab inserts "@handle " / "#topic ", Esc closes.
import { useEffect, useId, useState, type RefObject } from "react";
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { mentionSuggestionsAction, topicSuggestionsAction } from "@/app/actions";
import { he } from "@/lib/i18n/he";

// The partial mention / tag right before the caret (lib/mentions.ts, lib/tags.ts, no minimum).
// "@" takes a handle or a display name, in any script and with one space ("@דנה ל"): the
// server matches either, and picking one always inserts the @handle.
const PARTIAL = {
  "@": /(^|[^\p{L}\p{N}_@.])@(\p{L}[\p{L}\p{M}\p{N}_]{0,29}(?: [\p{L}\p{M}\p{N}_]{0,29})?)$/u,
  "#": /(^|[^\p{L}\p{M}\p{N}_#&/])#(\p{L}[\p{L}\p{M}\p{N}_-]{0,29})$/u,
} as const;
type Kind = keyof typeof PARTIAL;

// One shape for both lists: what to insert, and how the row reads.
type Item = { key: string; insert: string; label: string; detail: string; ltrDetail?: boolean };

const suggest = async (kind: Kind, q: string): Promise<Item[]> =>
  kind === "@"
    ? (await mentionSuggestionsAction(q)).map((u) => ({
        key: u.id,
        insert: `@${u.handle} `,
        label: u.displayName,
        detail: `@${u.handle}`,
        ltrDetail: true,
      }))
    : (await topicSuggestionsAction(q)).map((t) => ({
        key: t.tag,
        insert: `#${t.tag} `,
        label: `#${t.tag}`,
        detail: he.topics.posts(t.posts),
      }));

const LIST_WIDTH = 288; // w-72

/** Just under the caret at `pos`, kept inside the editor box (the list's positioned parent): in a
 * right-to-left paragraph the list's right edge is at the caret, in a left-to-right one its left
 * edge. Physical `left`, not inline-start: the list itself is always RTL like the page, so its
 * "start" is the right even inside an English paragraph. The caret, not the "@": a neutral "@"
 * between Hebrew and Latin text measures unreliably, and the caret is where the eye is. */
function anchor(view: EditorView, pos: number) {
  const box = (view.dom.offsetParent ?? view.dom).getBoundingClientRect();
  const at = view.coordsAtPos(pos);
  const at0 = view.domAtPos(pos).node;
  const block = at0 instanceof Element ? at0 : (at0.parentElement ?? view.dom);
  const rtl = getComputedStyle(block).direction === "rtl";
  const left = (rtl ? at.left - LIST_WIDTH : at.left) - box.left;
  return {
    top: at.bottom - box.top + 4,
    left: Math.max(0, Math.min(left, box.width - LIST_WIDTH)),
  };
}

export function useMentionSuggest(view: RefObject<EditorView | null>) {
  const listId = useId();
  // from/to: the "@partial" / "#partial" in the document, replaced on pick. top/left: where the
  // list opens, under the caret (px from the editor box's top and left).
  const [query, setQuery] = useState<{
    kind: Kind;
    q: string;
    from: number;
    to: number;
    top: number;
    left: number;
  } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState(0);

  // What is being typed at the caret (after every edit and caret move). Code doesn't mention.
  const track = (state: EditorState) => {
    const { empty, $from } = state.selection;
    const code = $from.parent.type.spec.code || state.schema.marks.code.isInSet($from.marks());
    if (!empty || code) return setQuery(null);
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    const v = view.current;
    for (const kind of ["@", "#"] as const) {
      const m = before.match(PARTIAL[kind]);
      if (!m || !v) continue;
      return setQuery({
        kind,
        q: m[2],
        from: $from.pos - m[2].length - 1,
        to: $from.pos,
        ...anchor(v, $from.pos),
      });
    }
    setQuery(null);
  };

  useEffect(() => {
    if (!query?.q) return;
    let stale = false;
    const t = setTimeout(async () => {
      const found = await suggest(query.kind, query.q);
      if (stale) return;
      setItems(found);
      setActive(0);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query?.kind, query?.q]);

  const open = !!query?.q && items.length > 0;

  const pick = (item: Item) => {
    const v = view.current;
    if (!v || !query) return;
    v.dispatch(v.state.tr.insertText(item.insert, query.from, query.to));
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
        style={{ top: query.top, left: query.left }}
        className="absolute z-30 w-72 overflow-hidden rounded-xl border border-neutral-200 bg-background py-1 text-start shadow-lg dark:border-neutral-800"
      >
        {items.map((item, i) => (
          <li
            key={item.key}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus in the editor
              pick(item);
            }}
            onMouseEnter={() => setActive(i)}
            className="flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm aria-selected:bg-neutral-500/10"
          >
            <span className="truncate font-bold" dir="auto">
              {item.label}
            </span>
            <span
              className="shrink-[3] truncate text-muted"
              dir={item.ltrDetail ? "ltr" : undefined}
            >
              {item.detail}
            </span>
          </li>
        ))}
      </ul>
    ) : null;

  return { track, onKeyDown, close: () => setQuery(null), aria, list };
}
