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

/** Searchable terms: runs of letters/digits, 2+ chars, deduped, at most MAX_TERMS. */
export function terms(input: string): string[] {
  return [
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
}

/**
 * Every term must match (AND); each term matches any of its variants as a word prefix
 * (`קוב` finds `קוברנטיס`). Returns null when nothing searchable is left.
 */
export function toTsQuery(input: string): string | null {
  const ts = terms(input);
  if (!ts.length) return null;
  return ts
    .map(
      (t) =>
        `(${variants(t)
          .map((v) => `${v}:*`)
          .join(" | ")})`,
    )
    .join(" & ");
}

// pg_trgm (docs/search.md). word_similarity(query, text) is 0..1: how well the query matches the
// best stretch of the text. Below these thresholds, matches are mostly noise.
export const FUZZY = {
  /** Post search fallback, when full-text search finds nothing. */
  posts: 0.5,
  /** People search: handle and display name. */
  people: 0.4,
  /** Shorter queries match too much to be useful. */
  minLength: 3,
} as const;

/** The query as plain words for pg_trgm, or null if it's too short to match fuzzily. */
export function fuzzyText(input: string): string | null {
  const text = terms(input).join(" ");
  return text.length >= FUZZY.minLength ? text : null;
}
