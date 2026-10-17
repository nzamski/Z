// Shared markdown renderer (PLAN.md §4) and feed preview computation (§6.3).
import MarkdownIt from "markdown-it";

export const md = new MarkdownIt({ html: false, linkify: true });
// No media in phase 1, and remote images would make requests to arbitrary hosts.
md.disable("image");
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("rel", "noopener noreferrer");
  return self.renderToken(tokens, idx, options);
};

export const renderMarkdown = (src: string) => md.render(src);

export const PREVIEW_CHARS = 500;
const FENCE = /^(\s*)(`{3,}|~{3,})/;

/** Whole top-level blocks up to ~limit chars; an oversized first block is cut on a line, then a word. */
export function computePreview(body: string, limit = PREVIEW_CHARS) {
  const lines = body.trim().split("\n");
  const src = lines.join("\n");
  const blocks = md
    .parse(src, {})
    .filter((t) => t.level === 0 && t.nesting !== -1 && t.map)
    .map((t) => lines.slice(t.map![0], t.map![1]).join("\n"));

  const kept: string[] = [];
  let used = 0;
  for (const b of blocks) {
    if (used + b.length > limit) break;
    kept.push(b);
    used += b.length;
  }
  if (kept.length || !blocks.length) {
    return { preview: kept.join("\n\n"), hasMore: kept.length < blocks.length };
  }
  return { preview: cutBlock(blocks[0], limit), hasMore: true };
}

function cutBlock(block: string, limit: number) {
  const out: string[] = [];
  let used = 0;
  for (const line of block.split("\n")) {
    if (used + line.length > limit) {
      if (!out.length) out.push(cutWord(line, limit));
      break;
    }
    out.push(line);
    used += line.length + 1;
  }
  // Re-close a code fence left open by the cut so the preview is valid markdown.
  let open: RegExpMatchArray | null = null;
  for (const line of out) {
    const m = line.match(FENCE);
    if (!m) continue;
    if (!open) open = m;
    else if (
      m[2][0] === open[2][0] &&
      m[2].length >= open[2].length &&
      !line.trim().slice(m[2].length)
    )
      open = null;
  }
  if (open) out.push(open[1] + open[2]);
  return out.join("\n");
}

function cutWord(line: string, limit: number) {
  const cut = line.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return space > limit / 2 ? cut.slice(0, space) : cut;
}
