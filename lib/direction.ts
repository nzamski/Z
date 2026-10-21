// Hebrew and English in one post: a paragraph (list item, heading, quote) reads right to left when
// most of its letters are Hebrew, left to right when most are Latin. Not the browser's dir="auto"
// (the first letter decides): Hebrew tech writing often starts with an English word or an
// @mention. Used by the renderer (lib/markdown.ts) and the composer, so both agree.

const HEBREW = /\p{Script=Hebrew}/gu;
const LATIN = /\p{Script=Latin}/gu;
// Not prose: links, @mentions and inline code don't vote.
const IGNORED = /https?:\/\/\S+|@[a-zA-Z][a-zA-Z0-9_]*|`[^`]*`/g;

/** "rtl" or "ltr" by majority of letters; null without letters (inherit). */
export function textDir(text: string): "rtl" | "ltr" | null {
  const t = text.replace(IGNORED, "");
  const he = t.match(HEBREW)?.length ?? 0;
  const la = t.match(LATIN)?.length ?? 0;
  if (!he && !la) return null;
  return he >= la ? "rtl" : "ltr";
}
