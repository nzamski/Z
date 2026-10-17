// Search query builder (PLAN.md §7.7, docs/search.md). Pure: turns user input into a
// `to_tsquery('simple', ...)` string. The index side is `z_search_vector()` (migration 0005).
//
// Hebrew glues one-letter prefixes (ו ה ב ל מ ש כ) onto words. Both sides strip a single prefix
// letter from Hebrew words of 4+ letters, so "השרת" and "שרת" find each other.

const PREFIXES = "והבלמשכ";
const HEBREW = /^[א-ת]+$/;
const MAX_TERMS = 8;

/** The forms a term may appear in the index under. */
export function variants(term: string): string[] {
  const out = [term];
  if (HEBREW.test(term) && term.length >= 4 && PREFIXES.includes(term[0])) out.push(term.slice(1));
  return out;
}

/**
 * Every term must match (AND); each term matches any of its variants as a word prefix
 * (`קוב` finds `קוברנטיס`). Returns null when nothing searchable is left.
 */
export function toTsQuery(input: string): string | null {
  const terms = [
    ...new Set(
      input
        .normalize("NFD")
        .replace(/\p{M}/gu, "") // niqqud and other marks
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u) // only letters and digits survive: nothing for tsquery to parse
        .filter((t) => t.length >= 2)
        .map((t) => t.slice(0, 50)),
    ),
  ].slice(0, MAX_TERMS);
  if (!terms.length) return null;
  return terms
    .map(
      (t) =>
        `(${variants(t)
          .map((v) => `${v}:*`)
          .join(" | ")})`,
    )
    .join(" & ");
}
