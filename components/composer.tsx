"use client";
// Composer (posts, comments): a WYSIWYG editor that reads and writes markdown
// (lib/editor-markdown.ts), so what you see is what gets posted. Formatting comes from the toolbar,
// the usual shortcuts (Ctrl/⌘+B, I, E) or typing markdown (**bold**, "- " for a list, ``` for code).
import "prosemirror-view/style/prosemirror.css";
import {
  Fragment as ReactFragment,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  Fragment,
  Slice,
  type MarkType,
  type Node as ProseMirrorNode,
  type NodeType,
} from "prosemirror-model";
import { liftListItem, sinkListItem, splitListItem, wrapInList } from "prosemirror-schema-list";
import { EditorState, Plugin, type Command } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import type { ActionResult } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { EmojiPicker } from "@/components/emoji-picker";
import { menuBox, useMenu } from "@/components/theme-menu";
import { CODE_LANGUAGES, highlightCode } from "@/lib/highlight";
import { PollFields, PollIcon } from "@/components/poll";
import { useMentionSuggest } from "@/components/mention-suggest";
import { DIR_MARK, markedDir, textDir } from "@/lib/direction";
import { splitMentions } from "@/lib/mentions";
import { splitTags } from "@/lib/tags";
import { parser, schema, toMarkdown } from "@/lib/editor-markdown";
import { hasContent } from "@/lib/markdown";
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
  author?: { displayName: string; handle: string | null; avatarSeed: string }; // the viewer, shown as an avatar
  compact?: boolean; // a small avatar, as in a comment thread (replies)
  poll?: boolean; // offers a poll (new posts)
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
/** Flip the current paragraph's direction: an invisible mark at its start (lib/direction.ts) when
 * the wanted direction differs from what its first word gives; none when they agree. */
const flipDir: Command = (s, d) => {
  const { $from } = s.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;
  const start = $from.start();
  const text = $from.parent.textContent;
  const marked = markedDir(text);
  const plain = marked ? text.slice(1) : text;
  const want = (textDir(text) ?? "rtl") === "rtl" ? "ltr" : "rtl";
  let tr = s.tr;
  if (marked) tr = tr.delete(start, start + 1);
  if (want !== (textDir(plain) ?? "rtl")) tr = tr.insertText(DIR_MARK[want], start);
  d?.(tr.scrollIntoView());
  return true;
};
const hasDirMark = (s: EditorState) => {
  const { parent } = s.selection.$from;
  return parent.isTextblock && !!markedDir(parent.textContent);
};

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

// Code blocks are highlighted as they will be in the post (lib/highlight.ts, same language rule):
// highlight.js's spans become inline decorations, recomputed only when the text changes.
function highlightDecos(doc: ProseMirrorNode) {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== N.code_block) return;
    const lang = String(node.attrs.params ?? "")
      .trim()
      .toLowerCase();
    const html = highlightCode(node.textContent, lang);
    if (!html) return false;
    let at = pos + 1;
    const walk = (el: Node, cls: string) => {
      for (const child of Array.from(el.childNodes)) {
        if (child instanceof HTMLElement) walk(child, `${cls} ${child.className}`.trim());
        else {
          const len = child.textContent?.length ?? 0;
          if (cls && len) decos.push(Decoration.inline(at, at + len, { class: cls }));
          at += len;
        }
      }
    };
    walk(new DOMParser().parseFromString(`<pre>${html}</pre>`, "text/html").body.firstChild!, "");
    return false;
  });
  return DecorationSet.create(doc, decos);
}
const highlight: Plugin<DecorationSet> = new Plugin<DecorationSet>({
  state: {
    init: (_, state) => highlightDecos(state.doc),
    apply: (tr, old) => (tr.docChanged ? highlightDecos(tr.doc) : old),
  },
  props: {
    decorations(state) {
      return highlight.getState(state);
    },
  },
});

const createState = (text: string) =>
  EditorState.create({
    doc: parser.parse(text),
    plugins: [history(), rules, keys, keymap(baseKeymap), direction, entities, highlight],
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

  // The poll's option texts while one is attached (PollFields); null without a poll.
  const [poll, setPoll] = useState<string[] | null>(null);
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

  // With a poll attached the question is short: one line, and the poll right under it (X-style).
  const hasPoll = poll !== null;
  useEffect(() => {
    view.current?.dom.style.setProperty("min-height", `${(hasPoll ? 1 : rows) * 1.7}em`);
  }, [hasPoll, rows]);

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

  const pollShort = poll !== null && poll.filter((o) => o.trim()).length < 2;

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
      setPoll(null);
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
        <Avatar seed={p.author.avatarSeed} handle={p.author.handle} small={p.compact} noCard />
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
        {poll && <PollFields options={poll} onChange={setPoll} />}
        {/* One row under a thin line: formatting on one side, send (and its state) on the other. */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 text-sm dark:border-neutral-800">
          <div
            role="toolbar"
            aria-label={T.toolbar}
            className="flex flex-wrap items-center gap-0.5"
          >
            {tools.map((t) => (
              <ReactFragment key={t.label}>
                <button
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
                {/* In a code block: its language, right beside the code block button. */}
                {t.label === T.codeBlock && t.active && (
                  <CodeLanguage
                    value={(editor?.selection.$from.parent.attrs.params as string) ?? ""}
                    onPick={(params) =>
                      run((st, d) => {
                        const $f = st.selection.$from;
                        d?.(
                          st.tr.setNodeMarkup($f.before(), undefined, {
                            ...$f.parent.attrs,
                            params,
                          }),
                        );
                        return true;
                      })
                    }
                  />
                )}
              </ReactFragment>
            ))}
            {p.poll && (
              <button
                type="button"
                data-tip={T.poll}
                aria-label={T.poll}
                aria-pressed={poll !== null}
                disabled={poll !== null} // removed from the poll box itself
                onClick={() => setPoll(["", ""])}
                className="grid size-8 place-items-center rounded-full text-muted transition-colors enabled:hover:bg-neutral-500/10 enabled:hover:text-foreground aria-pressed:bg-neutral-500/15 aria-pressed:text-foreground"
              >
                <PollIcon />
              </button>
            )}
            <EmojiPicker
              onPick={(emoji) =>
                run((st, d) => {
                  d?.(st.tr.insertText(emoji).scrollIntoView());
                  return true;
                })
              }
            />
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
              disabled={pending || over || pollShort || (!p.allowEmpty && !hasContent(body))}
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
    { label: T.direction, icon: ICONS.direction, active: hasDirMark(s), cmd: flipDir },
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
  // A paragraph mark between two arrows: switch this paragraph's direction.
  direction: (
    <Svg>
      <path d="M10 4v10M14 4v10M17 4h-7a3 3 0 0 0 0 6M3 19h18M6 16l-3 3 3 3M18 16l3 3-3 3" />
    </Svg>
  ),
};

/** While the caret is in a code block: its language, for highlighting (lib/highlight.ts). Saved
 * in the fence (```python); "Auto" leaves it to a guess. Fixed to the screen (like the emoji
 * picker): below the button when there's room, else above, never cut off by a popup's edge. */
const LANG_H = 264; // px: the list's max-h-64 and a margin

function CodeLanguage(p: { value: string; onPick: (lang: string) => void }) {
  const { open, setOpen, root } = useMenu();
  const [at, setAt] = useState({ top: 0, left: 0 });
  const current = CODE_LANGUAGES.find(([v]) => v === p.value)?.[1] ?? he.composer.codeAuto;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the caret in the block
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({
            top: innerHeight - r.bottom >= LANG_H ? r.bottom + 4 : Math.max(8, r.top - LANG_H),
            left: Math.max(8, r.left),
          });
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${he.composer.codeLanguage}: ${current}`}
        dir="ltr"
        className="flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-expanded:bg-neutral-500/15"
      >
        {current}
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          style={at}
          className={`fixed ${menuBox} max-h-64 w-44 overflow-y-auto`}
          dir="ltr"
        >
          {[["", he.composer.codeAuto] as [string, string], ...CODE_LANGUAGES].map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="menuitemradio"
              aria-checked={v === (p.value || "")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                p.onPick(v);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-start text-sm transition-colors hover:bg-neutral-500/10 aria-checked:font-bold aria-checked:text-link"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** X-style counter, only near the limit: a filling ring from 80%, the numbers from 90%. */
export function LengthRing(p: { length: number; max: number; alwaysCount?: boolean }) {
  const { length, max } = p;
  if (!length || (length < max * 0.8 && !p.alwaysCount)) return null;
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
