// Hebrew and English in one post: each paragraph (list item, heading, quote) has its own direction.
// By default it follows the paragraph's first word: Hebrew reads right to left, English left to
// right. @mentions, #tags, links, inline code and numbers are skipped (they're not the sentence).
// The writer can override a paragraph from the composer: an invisible direction mark at its start
// (RLM / LRM, which markdown keeps as text) wins over the first word.
// Used by the renderer (lib/markdown.ts) and the composer, so both agree.

export const DIR_MARK = { rtl: "‏", ltr: "‎" } as const;

const HEBREW = /\p{Script=Hebrew}/u;
const LATIN = /\p{Script=Latin}/u;
// Not the sentence: links, @mentions, #tags and inline code.
const IGNORED = /https?:\/\/\S+|[@#][\p{L}\p{N}_-]+|`[^`]*`/gu;

/** The direction a writer chose for a paragraph (its leading mark), if any. */
export function markedDir(text: string): "rtl" | "ltr" | null {
  const first = text.trimStart()[0];
  return first === DIR_MARK.rtl ? "rtl" : first === DIR_MARK.ltr ? "ltr" : null;
}

/** "rtl" or "ltr": the writer's mark, else the first word's script; null without letters (the
 * paragraph inherits the page's RTL). */
export function textDir(text: string): "rtl" | "ltr" | null {
  const marked = markedDir(text);
  if (marked) return marked;
  for (const word of text.replace(IGNORED, " ").split(/\s+/)) {
    if (HEBREW.test(word)) return "rtl";
    if (LATIN.test(word)) return "ltr";
  }
  return null;
}
