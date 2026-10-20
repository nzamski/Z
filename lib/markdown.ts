// Shared markdown renderer (PLAN.md §4) for posts and comments; bios stay plain text.
// Runs on the server and in the composer preview. Safe to inject as HTML: raw HTML is escaped
// (html: false), images are off (no media, and remote images would call arbitrary hosts), and
// markdown-it's validateLink refuses javascript:, vbscript:, file: and data: links.
import MarkdownIt from "markdown-it";

export const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
md.disable("image");
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, idx, options);
};

export const renderMarkdown = (src: string) => md.render(src);
