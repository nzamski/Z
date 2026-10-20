// Feed preview of a markdown post, computed on save (PLAN.md §6.3): whole top-level blocks up to
// `limit` characters and `maxLines` lines. An oversized first block is cut on a line, then a word,
// and a code fence left open by the cut is closed again, so the preview is always valid markdown.
import { md } from "@/lib/markdown";

const FENCE = /^(\s*)(`{3,}|~{3,})/;

export function computePreview(body: string, limit = 500, maxLines = 10) {
  const src = body.replace(/\r\n?/g, "\n").trim();
  const lines = src.split("\n");
  const blocks = md
    .parse(src, {})
    .filter((t) => t.level === 0 && t.nesting !== -1 && t.map)
    .map((t) => lines.slice(t.map![0], t.map![1]));

  const kept: string[] = [];
  let chars = 0;
  let used = 0;
  for (const b of blocks) {
    const text = b.join("\n");
    if (chars + text.length > limit || used + b.length > maxLines) break;
    kept.push(text);
    chars += text.length;
    used += b.length;
  }
  if (kept.length === blocks.length) return { preview: src, hasMore: false };
  if (kept.length) return { preview: kept.join("\n\n"), hasMore: true };
  return { preview: cutBlock(blocks[0], limit, maxLines), hasMore: true };
}

function cutBlock(block: string[], limit: number, maxLines: number) {
  const out: string[] = [];
  let used = 0;
  for (const line of block) {
    if (out.length >= maxLines) break;
    if (used + line.length > limit) {
      if (!out.length) out.push(cutWord(line, limit));
      break;
    }
    out.push(line);
    used += line.length + 1;
  }
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
  const space = cut.search(/\s\S*$/);
  return space > limit / 2 ? cut.slice(0, space) : cut; // one huge word: hard cut
}
