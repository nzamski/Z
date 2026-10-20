// The composer's document model (components/composer.tsx): a ProseMirror schema that reads and
// writes the same markdown the server renders (lib/markdown.ts). Bodies are stored as markdown;
// the editor is only a way of writing it.
import MarkdownIt from "markdown-it";
import { Schema, type Node } from "prosemirror-model";
import {
  defaultMarkdownParser,
  defaultMarkdownSerializer,
  MarkdownParser,
  MarkdownSerializer,
  schema as base,
} from "prosemirror-markdown";

// Lists made in the editor (or pasted from a page) are tight, like a list typed in markdown;
// lists parsed from a body keep what they had.
const tight = (name: string, attrs: (dom: HTMLElement) => Record<string, unknown> = () => ({})) => {
  const spec = base.spec.nodes.get(name)!;
  return {
    ...spec,
    attrs: { ...spec.attrs, tight: { default: true } },
    parseDOM: [{ tag: name === "bullet_list" ? "ul" : "ol", getAttrs: attrs }],
  };
};

export const schema = new Schema({
  nodes: base.spec.nodes
    // Images are off in lib/markdown.ts (headings named them in their content).
    .remove("image")
    .update("heading", { ...base.spec.nodes.get("heading")!, content: "text*" })
    .update("bullet_list", tight("bullet_list"))
    .update(
      "ordered_list",
      tight("ordered_list", (dom) => ({ order: +(dom.getAttribute("start") ?? 1) })),
    ),
  marks: base.spec.marks.addToEnd("strike", {
    parseDOM: [{ tag: "s" }, { tag: "del" }, { tag: "strike" }],
    toDOM: () => ["s", 0],
  }),
});

// lib/markdown.ts's options minus what it adds at render time: URLs and @handles stay plain text
// here and become links when the post is shown. Tables have no node, so they stay text too.
const md = new MarkdownIt({ html: false, linkify: false, breaks: true }).disable([
  "image",
  "table",
]);

const tokens = { ...defaultMarkdownParser.tokens };
delete tokens.image;
export const parser = new MarkdownParser(schema, md, {
  ...tokens,
  softbreak: { node: "hard_break" }, // breaks: true, a single newline is a line break
  s: { mark: "strike" },
});

const serializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    bullet_list: (state, node) => state.renderList(node, "  ", () => "- "),
    // A plain newline (breaks: true) instead of CommonMark's backslash. A trailing break is dropped.
    hard_break(state, node, parent, index) {
      for (let i = index + 1; i < parent.childCount; i++)
        if (parent.child(i).type != node.type) return state.write("\n");
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
  },
);

export const toMarkdown = (doc: Node) => serializer.serialize(doc, { tightLists: true }).trim();
