"use client";
// Composer (posts, comments): a WYSIWYG editor that reads and writes markdown
// (lib/editor-markdown.ts), so what you see is what gets posted. Formatting comes from the toolbar,
// the usual shortcuts (Ctrl/⌘+B, I, E) or typing markdown (**bold**, "- " for a list, ``` for code).
import "prosemirror-view/style/prosemirror.css";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  baseKeymap,
  chainCommands,
  exitCode,
  lift,
  setBlockType,
  toggleMark,
  wrapIn,
} from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  undoInputRule,
  wrappingInputRule,
} from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { Fragment, Slice, type MarkType, type NodeType } from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { EditorState, Plugin, type Command } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import type { ActionResult } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { useMentionSuggest } from "@/components/mention-suggest";
import { textDir } from "@/lib/direction";
import { splitMentions } from "@/lib/mentions";
import { splitTags } from "@/lib/tags";
import { parser, schema, toMarkdown } from "@/lib/editor-markdown";
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
  allowEmpty?: boolean;
  draft?: string; // autosave key (per browser): new posts, comments and replies, not edits
  focusOn?: string; // a URL hash ("reply"): arriving with it puts the caret here, ready to type
  autoFocus?: boolean; // the caret starts here (the comment popup)
  author?: { displayName: string; handle: string | null }; // the viewer, shown as an avatar
  compact?: boolean; // a small avatar, as in a comment thread (replies)
};

// Drafts survive a closed tab or a reload; posting, cancelling or emptying the editor drops them.
const DRAFT = "z-draft:";
function readDraft(key?: string) {
  try {
    return key ? localStorage.getItem(DRAFT + key) : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string | undefined, body: string) {
  if (!key) return;
  try {
    if (body.trim()) localStorage.setItem(DRAFT + key, body);
    else localStorage.removeItem(DRAFT + key);
  } catch {} // storage full or blocked: the editor still works, just without a draft
}

const { nodes: N, marks: M } = schema;

const markActive = (s: EditorState, type: MarkType) => {
  const { from, to, empty, $from } = s.selection;
  return empty
    ? !!type.isInSet(s.storedMarks ?? $from.marks())
    : s.doc.rangeHasMark(from, to, type);
};
const inNode = (s: EditorState, type: NodeType) => {
  const { $from } = s.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === type) return true;
  return false;
};
const toggleList =
  (type: NodeType): Command =>
  (s, d) =>
    inNode(s, type) ? liftListItem(N.list_item)(s, d) : wrapInList(type)(s, d);
const toggleCodeBlock: Command = (s, d) =>
  setBlockType(s.selection.$from.parent.type === N.code_block ? N.paragraph : N.code_block)(s, d);
const hardBreak: Command = (s, d) => {
  d?.(s.tr.replaceSelectionWith(N.hard_break.create()).scrollIntoView());
  return true;
};
/** Drops the link under the caret (the whole link) or in the selection. */
const removeLink: Command = (s, d) => {
  let { from, to } = s.selection;
  if (s.selection.empty) {
    const { $from } = s.selection;
    const link = M.link.isInSet($from.marks());
    if (!link) return false;
    const start = $from.start();
    from = to = $from.pos;
    $from.parent.forEach((child, offset) => {
      if (!link.isInSet(child.marks)) return;
      const a = start + offset;
      const b = a + child.nodeSize;
      // Children are visited in order; a run of linked children touching the caret is the link.
      if (b >= from && a <= to) [from, to] = [Math.min(from, a), Math.max(to, b)];
    });
  }
  d?.(s.tr.removeMark(from, to, M.link));
  return true;
};

// **bold**, _italic_ / *italic*, `code`, ~~strike~~ typed out become formatting.
const markRule = (re: RegExp, type: MarkType) =>
  new InputRule(re, (s, [, lead, text], start, end) =>
    s.tr
      .replaceWith(start + lead.length, end, schema.text(text, [type.create()]))
      .removeStoredMark(type),
  );
const rules = inputRules({
  rules: [
    markRule(/(^|[^*])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, M.strong),
    markRule(/(^|[^*])\*([^*\s](?:[^*]*[^*\s])?)\*$/, M.em),
    markRule(/(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*[^_\s])?)_$/u, M.em),
    markRule(/(^|[^`])`([^`]+)`$/, M.code),
    markRule(/(^|[^~])~~([^~]+)~~$/, M.strike),
    wrappingInputRule(/^\s*([-+*])\s$/, N.bullet_list),
    wrappingInputRule(
      /^(\d+)\.\s$/,
      N.ordered_list,
      (m) => ({ order: +m[1] }),
      (m, node) => node.childCount + node.attrs.order == +m[1],
    ),
    wrappingInputRule(/^\s*>\s$/, N.blockquote),
    textblockTypeInputRule(/^```$/, N.code_block),
  ],
});

const keys = keymap({
  "Mod-z": undo,
  "Shift-Mod-z": redo,
  "Mod-y": redo,
  "Mod-b": toggleMark(M.strong),
  "Mod-i": toggleMark(M.em),
  "Mod-e": toggleMark(M.code),
  Enter: splitListItem(N.list_item),
  "Shift-Enter": chainCommands(exitCode, hardBreak),
  Tab: sinkListItem(N.list_item),
  "Shift-Tab": liftListItem(N.list_item),
  Backspace: undoInputRule,
});

// Each block reads in the direction most of its letters do, recomputed as you type (lib/
// direction.ts; published posts use the same rule).
const DIRECTED = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bullet_list",
  "ordered_list",
  "list_item",
]);
const direction = new Plugin({
  props: {
    decorations(state) {
      const decos: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (!DIRECTED.has(node.type.name)) return;
        const dir = textDir(node.textContent);
        if (dir) decos.push(Decoration.node(pos, pos + node.nodeSize, { dir }));
      });
      return DecorationSet.create(state.doc, decos);
    },
  },
});

// #tags and @mentions look in the composer as they will in the post: link colored, and kept whole
// inside Hebrew ("#kubernetes", not "kubernetes#"). Same rules as the renderer; code is left alone.
const entities = new Plugin({
  props: {
    decorations(state) {
      const decos: Decoration[] = [];
      state.doc.descendants((node, pos, parent) => {
        if (!node.isText || parent?.type.spec.code || M.code.isInSet(node.marks)) return;
        const text = node.text!;
        let at = 0;
        for (const parts of [splitMentions(text), splitTags(text)]) {
          at = 0;
          for (const part of parts) {
            const len = "text" in part ? part.text.length : part.raw.length;
            if (!("text" in part))
              decos.push(
                Decoration.inline(pos + at, pos + at + len, { class: "text-link", dir: "auto" }),
              );
            at += len;
          }
        }
      });
      return DecorationSet.create(state.doc, decos);
    },
  },
});

const createState = (text: string) =>
  EditorState.create({
    doc: parser.parse(text),
    plugins: [history(), rules, keys, keymap(baseKeymap), direction, entities],
  });

// Pasted plain text is read as markdown (outside code), so pasting a draft keeps its formatting.
const clipboardTextParser = (text: string, $at: { parent: { type: NodeType } }) =>
  !text
    ? Slice.empty
    : $at.parent.type.spec.code
      ? new Slice(Fragment.from(schema.text(text)), 0, 0)
      : Slice.maxOpen(parser.parse(text).content);

// Copied as plain text (into a chat, a doc): one line per paragraph, line break or list item. The
// default puts a blank line between paragraphs, so every Enter came out double spaced. The rich
// copy (pasting back into Z, or into a rich editor) is unchanged.
const clipboardTextSerializer = (slice: Slice) =>
  slice.content.textBetween(0, slice.content.size, "\n", (leaf) =>
    leaf.type === N.hard_break ? "\n" : "",
  );

const isEmpty = (s: EditorState | null) =>
  !s ||
  (s.doc.childCount === 1 &&
    s.doc.firstChild!.type === N.paragraph &&
    !s.doc.firstChild!.content.size);

export function Composer(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [link, setLink] = useState<string | null>(null); // the link field, when open
  const mentions = useMentionSuggest(view);
  const latest = useRef(mentions);
  useEffect(() => {
    latest.current = mentions;
  });

  const rows = p.rows ?? 4;
  useEffect(() => {
    const v: EditorView = new EditorView(host.current!, {
      state: createState(readDraft(p.draft) ?? p.initial ?? ""),
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": p.placeholder,
        class: "md py-1 outline-none",
        style: `min-height: ${rows * 1.7}em`,
      },
      dispatchTransaction(tr) {
        const s = v.state.apply(tr);
        v.updateState(s);
        setEditor(s);
        latest.current.track(s);
      },
      handleKeyDown: (view, e) => {
        if (latest.current.onKeyDown(e)) return true; // the mention list's keys (Esc closes it)
        // ProseMirror swallows Esc, so a dialog around the editor (the comment popup) never sees
        // it: close that dialog here.
        if (e.key === "Escape") view.dom.closest("dialog")?.close();
        return false;
      },
      handleDOMEvents: {
        blur: () => {
          setTimeout(() => latest.current.close(), 150); // let a click on a suggestion land
          return false;
        },
      },
      clipboardTextParser,
      clipboardTextSerializer,
    });
    view.current = v;
    setEditor(v.state);
    if (p.autoFocus) v.focus();
    return () => {
      v.destroy();
      view.current = null;
    };
  }, [p.initial, p.placeholder, rows, p.draft, p.autoFocus]);

  // The comment button links to #reply (from a card, or on the post page itself).
  useEffect(() => {
    if (!p.focusOn) return;
    const go = () => {
      if (location.hash === `#${p.focusOn}`) view.current?.focus();
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [p.focusOn]);

  // The mention list's ARIA lives on the editable element, which ProseMirror owns.
  useEffect(() => {
    const dom = view.current?.dom;
    if (!dom) return;
    for (const [k, v] of Object.entries(mentions.aria))
      if (v) dom.setAttribute(k, v);
      else dom.removeAttribute(k);
  });

  const body = useMemo(
    () => (editor ? toMarkdown(editor.doc) : (p.initial ?? "")),
    [editor, p.initial],
  );
  const ready = editor !== null; // before that, body is only p.initial
  useEffect(() => {
    if (ready) writeDraft(p.draft, body);
  }, [ready, body, p.draft]);

  const [state, formAction, pending] = useActionState(async (prev: ActionResult, f: FormData) => {
    const r = await p.action(prev, f);
    if (r.ok) {
      writeDraft(p.draft, ""); // now, not on the next render: onDone may unmount this
      const v = view.current;
      if (v) {
        v.updateState(createState(p.initial ?? ""));
        setEditor(v.state);
      }
      setLink(null);
      p.onDone?.();
    }
    return r;
  }, {});
  const over = body.length > p.max;

  const run = (cmd: Command) => {
    const v = view.current;
    if (!v) return;
    cmd(v.state, v.dispatch, v);
    v.focus();
  };
  const addLink = () => {
    const url = link?.trim();
    setLink(null);
    if (!url) return view.current?.focus();
    const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
    run((s, d) => {
      const mark = M.link.create({ href });
      d?.(
        s.selection.empty
          ? s.tr.replaceSelectionWith(schema.text(url, [mark]), false)
          : s.tr.addMark(s.selection.from, s.selection.to, mark),
      );
      return true;
    });
  };

  const T = he.composer;
  const tools = editor ? toolsFor(editor, link !== null) : [];

  return (
    <form action={formAction} className="flex gap-3">
      {p.author && (
        <Avatar name={p.author.displayName} handle={p.author.handle} small={p.compact} noCard />
      )}
      <div className="min-w-0 flex-1">
        {Object.entries(p.hidden ?? {}).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="body" value={body} />
        {/* No border: the text has the whole box. The mention list is positioned in here. */}
        <div className="relative">
          {isEmpty(editor) && (
            <span
              aria-hidden
              className="pointer-events-none absolute start-0 top-1 leading-[1.7] text-muted"
            >
              {p.placeholder}
            </span>
          )}
          {/* ProseMirror owns this element's children. */}
          <div ref={host} />
          {link !== null && (
            <div className="flex items-center gap-2 pb-1 text-sm">
              <input
                autoFocus
                type="text"
                inputMode="url"
                dir="ltr"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault(); // not the form
                    addLink();
                  } else if (e.key === "Escape") {
                    setLink(null);
                    view.current?.focus();
                  }
                }}
                placeholder={T.linkPlaceholder}
                aria-label={T.linkPlaceholder}
                className="min-w-0 flex-1 rounded-md bg-neutral-500/10 px-2 py-1 outline-none"
              />
              <button
                type="button"
                onClick={addLink}
                className="font-medium text-link hover:underline"
              >
                {T.linkAdd}
              </button>
            </div>
          )}
          {mentions.list}
        </div>
        {/* One row under a thin line: formatting on one side, send (and its state) on the other. */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 text-sm dark:border-neutral-800">
          <div
            role="toolbar"
            aria-label={T.toolbar}
            className="flex flex-wrap items-center gap-0.5"
          >
            {tools.map((t) => (
              <button
                key={t.label}
                type="button"
                data-tip={t.label}
                aria-label={t.label}
                aria-pressed={t.active}
                onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
                // No command: the link button, which opens (or closes) the link field.
                onClick={() => (t.cmd ? run(t.cmd) : setLink((l) => (l === null ? "" : null)))}
                className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-pressed:bg-neutral-500/15 aria-pressed:text-foreground"
              >
                {t.icon}
              </button>
            ))}
          </div>
          {/* The send button last, at the row's far end: the counter and cancel that come and go
              as you type appear before it, so it never moves. */}
          <div className="flex items-center gap-3">
            <LengthRing length={body.length} max={p.max} />
            {p.onCancel && (
              <button
                type="button"
                onClick={() => {
                  writeDraft(p.draft, "");
                  p.onCancel?.();
                }}
                className="text-muted hover:text-foreground hover:underline"
              >
                {T.cancel}
              </button>
            )}
            <button
              disabled={pending || over || (!p.allowEmpty && !body.trim())}
              className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
            >
              {p.submitLabel}
            </button>
          </div>
        </div>
        {/* Errors and warnings in their own row under the buttons, never squeezed beside them. */}
        {(state.error || over) && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {state.error ?? T.tooLong}
          </p>
        )}
      </div>
    </form>
  );
}

const wrapBlockquote = wrapIn(N.blockquote);

/** The toolbar for the current state: each button's command and whether it's on. */
function toolsFor(s: EditorState, linkFieldOpen: boolean) {
  const T = he.composer;
  const onLink = markActive(s, M.link);
  const inQuote = inNode(s, N.blockquote);
  return [
    { label: T.bold, icon: ICONS.bold, active: markActive(s, M.strong), cmd: toggleMark(M.strong) },
    { label: T.italic, icon: ICONS.italic, active: markActive(s, M.em), cmd: toggleMark(M.em) },
    { label: T.code, icon: ICONS.code, active: markActive(s, M.code), cmd: toggleMark(M.code) },
    {
      label: onLink ? T.unlink : T.link,
      icon: ICONS.link,
      active: onLink || linkFieldOpen,
      cmd: onLink ? removeLink : null,
    },
    {
      label: T.bulletList,
      icon: ICONS.bulletList,
      active: inNode(s, N.bullet_list),
      cmd: toggleList(N.bullet_list),
    },
    {
      label: T.orderedList,
      icon: ICONS.orderedList,
      active: inNode(s, N.ordered_list),
      cmd: toggleList(N.ordered_list),
    },
    { label: T.quote, icon: ICONS.quote, active: inQuote, cmd: inQuote ? lift : wrapBlockquote },
    {
      label: T.codeBlock,
      icon: ICONS.codeBlock,
      active: s.selection.$from.parent.type === N.code_block,
      cmd: toggleCodeBlock,
    },
  ];
}

const Svg = ({ children, flip }: { children: React.ReactNode; flip?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className={`size-[18px] ${flip ? "rtl:-scale-x-100" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const ICONS = {
  bold: (
    <Svg>
      <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" strokeWidth={2.5} />
    </Svg>
  ),
  italic: (
    <Svg>
      <path d="M19 4h-9M14 20H5M15 4 9 20" />
    </Svg>
  ),
  code: (
    <Svg>
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </Svg>
  ),
  link: (
    <Svg>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  ),
  // Lists and quotes mirror in RTL: bullets, numbers and the quote bar sit at the start.
  bulletList: (
    <Svg flip>
      <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" strokeWidth={2.5} />
    </Svg>
  ),
  orderedList: (
    <Svg flip>
      <path d="M10 6h11M10 12h11M10 18h11M4 4h1v5M4 9h2M6 20H4c0-1.2 2-2 2-3.2a1.2 1.2 0 0 0-2-.8" />
    </Svg>
  ),
  quote: (
    <Svg flip>
      <path d="M4 5v14M9 7h11M9 12h11M9 17h7" />
    </Svg>
  ),
  codeBlock: (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m10 10-2 2 2 2M14 10l2 2-2 2" />
    </Svg>
  ),
};

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
