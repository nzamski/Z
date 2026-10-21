// Hebrew and English in one post: a paragraph (list item, heading, quote) reads right to left when
// most of its words are Hebrew, left to right when most are English (a tie: Hebrew, Z's language).
// Words, not letters: tech terms are long ("Keycloak", "X-Forwarded") and Hebrew writes fewer
// letters per word, so a Hebrew sentence full of terms would count as English. Not the browser's
// dir="auto" either (the first letter decides): Hebrew often starts with a term or an @mention.
// Used by the renderer (lib/markdown.ts) and the composer, so both agree.

const HEBREW = /\p{Script=Hebrew}/u;
const LATIN = /\p{Script=Latin}/u;
// Not prose: links, @mentions and inline code don't vote.
const IGNORED = /https?:\/\/\S+|@[a-zA-Z][a-zA-Z0-9_]*|`[^`]*`/g;

/** "rtl" or "ltr" by majority of words; null without letters (inherit). */
export function textDir(text: string): "rtl" | "ltr" | null {
  let he = 0;
  let la = 0;
  for (const word of text.replace(IGNORED, " ").split(/\s+/)) {
    if (HEBREW.test(word)) he++;
    else if (LATIN.test(word)) la++;
  }
  if (!he && !la) return null;
  return he >= la ? "rtl" : "ltr";
}
