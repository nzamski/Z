// Shared markdown renderer (PLAN.md §4) for posts and comments; bios stay plain text.
// Runs on the server and in the composer preview. Safe to inject as HTML: raw HTML is escaped
// (html: false), images are off (no media, and remote images would call arbitrary hosts), and
// markdown-it's validateLink refuses javascript:, vbscript:, file: and data: links.
import MarkdownIt from "markdown-it";
import { textDir } from "@/lib/direction";
import { highlightCode } from "@/lib/highlight";
import { MENTIONS_MAX, splitMentions } from "@/lib/mentions";
import { splitTags, tagHref, TAGS_MAX } from "@/lib/tags";

export const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight: (code, lang) => highlightCode(code, lang.trim().toLowerCase()),
});
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

// Typed from the instance, so it's the same markdown-it typing md itself uses.
type CoreRule = Parameters<typeof md.core.ruler.push>[1];

/** A core rule turning matches in plain text into links (after linkify, so links and code are
 * left alone). `split` returns text parts and link parts (`raw` text, `href`). */
function linkRule(
  className: string,
  split: (text: string) => ({ text: string } | { raw: string; href: string })[],
) {
  const rule: CoreRule = (state) => {
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
        for (const part of split(t.content)) {
          const text = new state.Token("text", "", 0);
          if ("text" in part) {
            text.content = part.text;
            out.push(text);
            continue;
          }
          const open = new state.Token("link_open", "a", 1);
          // dir=auto: "#kubernetes" / "@dana" stay whole inside Hebrew text (not "kubernetes#").
          open.attrs = [
            ["href", part.href],
            ["class", className],
            ["dir", "auto"],
          ];
          text.content = part.raw;
          out.push(open, text, new state.Token("link_close", "a", -1));
        }
      }
      block.children = out;
    }
  };
  return rule;
}

// @handle -> the profile; #topic -> the topic page.
md.core.ruler.push(
  "mentions",
  linkRule("mention", (s) =>
    splitMentions(s).map((p) => ("text" in p ? p : { raw: p.raw, href: `/u/${p.handle}` })),
  ),
);
md.core.ruler.push(
  "tags",
  linkRule("tag", (s) =>
    splitTags(s).map((p) => ("text" in p ? p : { raw: p.raw, href: tagHref(p.tag) })),
  ),
);

export const renderMarkdown = (src: string) => md.render(src);

// Not content: whitespace, direction marks (lib/direction.ts), zero-width characters.
const INVISIBLE = /[\s\u200B-\u200F\u2060\uFEFF]/gu;

/** Whether a body shows anything: some text or code, not just whitespace, invisible marks or empty
 * markup (an empty code block, "**", a rule). Posts and comments need it (lib/services.ts), and
 * the composer only enables "publish" when it holds. */
export function hasContent(src: string) {
  for (const t of md.parse(src, {})) {
    const texts =
      t.type === "inline"
        ? (t.children ?? []).filter((c) => c.type === "text" || c.type === "code_inline")
        : t.type === "fence" || t.type === "code_block"
          ? [t]
          : [];
    if (texts.some((c) => c.content.replace(INVISIBLE, ""))) return true;
  }
  return false;
}

/** The hrefs of the links of one class, in order of appearance, unique. */
function linksOf(src: string, className: string) {
  const hrefs = new Set<string>();
  for (const t of md.parse(src, {}))
    for (const c of t.children ?? [])
      if (c.type === "link_open" && c.attrGet("class") === className)
        hrefs.add(String(c.attrGet("href")));
  return [...hrefs];
}

/** The handles mentioned in a body: exactly the ones rendered as mention links (lowercase,
 * unique, at most MENTIONS_MAX). */
export const extractMentions = (src: string) =>
  linksOf(src, "mention")
    .map((h) => h.slice("/u/".length))
    .slice(0, MENTIONS_MAX);

/** The topics of a body: exactly the ones rendered as tag links (normalized, unique, at most
 * TAGS_MAX). */
export const extractTags = (src: string) =>
  linksOf(src, "tag")
    .map((h) => decodeURIComponent(h.slice("/t/".length)))
    .slice(0, TAGS_MAX);
