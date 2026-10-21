// Shared markdown renderer (PLAN.md §4) for posts and comments; bios stay plain text.
// Runs on the server and in the composer preview. Safe to inject as HTML: raw HTML is escaped
// (html: false), images are off (no media, and remote images would call arbitrary hosts), and
// markdown-it's validateLink refuses javascript:, vbscript:, file: and data: links.
import MarkdownIt from "markdown-it";
import { textDir } from "@/lib/direction";
import { MENTIONS_MAX, splitMentions } from "@/lib/mentions";

export const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
md.disable("image");
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, idx, options);
};

// Hebrew and English in one post: each block reads in the direction most of its letters do
// (lib/direction.ts, as in the composer). Code blocks are always left to right (globals.css).
const DIRECTED = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "bullet_list",
  "ordered_list",
  "list_item",
]);
md.core.ruler.push("direction", (state) => {
  const open: { token: (typeof state.tokens)[number]; text: string }[] = [];
  for (const t of state.tokens) {
    const type = t.type.replace(/_(open|close)$/, "");
    if (t.nesting === 1 && DIRECTED.has(type)) open.push({ token: t, text: "" });
    else if (t.type === "inline") for (const o of open) o.text += ` ${t.content}`;
    else if (t.nesting === -1 && DIRECTED.has(type)) {
      const o = open.pop()!;
      const dir = textDir(o.text);
      if (dir) o.token.attrSet("dir", dir);
    }
  }
});

// @handle -> a link to the profile (after linkify, so links and code are left alone).
md.core.ruler.push("mentions", (state) => {
  for (const block of state.tokens) {
    if (block.type !== "inline" || !block.children) continue;
    const out: typeof block.children = [];
    let inLink = 0;
    for (const t of block.children) {
      if (t.type === "link_open") inLink++;
      if (t.type === "link_close") inLink--;
      if (t.type !== "text" || inLink) {
        out.push(t);
        continue;
      }
      for (const part of splitMentions(t.content)) {
        if ("text" in part) {
          const text = new state.Token("text", "", 0);
          text.content = part.text;
          out.push(text);
          continue;
        }
        const open = new state.Token("link_open", "a", 1);
        open.attrs = [
          ["href", `/u/${part.handle}`],
          ["class", "mention"],
        ];
        const text = new state.Token("text", "", 0);
        text.content = part.raw;
        out.push(open, text, new state.Token("link_close", "a", -1));
      }
    }
    block.children = out;
  }
});

export const renderMarkdown = (src: string) => md.render(src);

/** The handles mentioned in a body: exactly the ones rendered as mention links (lowercase,
 * unique, at most MENTIONS_MAX). */
export function extractMentions(src: string) {
  const handles = new Set<string>();
  for (const t of md.parse(src, {}))
    for (const c of t.children ?? [])
      if (c.type === "link_open" && c.attrGet("class") === "mention")
        handles.add(String(c.attrGet("href")).slice("/u/".length));
  return [...handles].slice(0, MENTIONS_MAX);
}
