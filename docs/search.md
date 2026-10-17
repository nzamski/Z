# Search

Code: `lib/search.ts` (query builder), `feedPage({ query })` in `lib/services.ts`, page
`app/search/page.tsx`, SQL in `drizzle/0005_search.sql` (function) and
`drizzle/0006_search_column.sql` (column + index). Spec: PLAN.md §7.7.

## How it works

- Postgres full-text search with the built-in `simple` configuration: words are lower-cased
  and split, with no language-specific stemming and no extensions.
- `posts.search` is a stored generated column, `z_search_vector(body)`, with a partial GIN
  index (`posts_search_idx`, live posts only). Postgres keeps it in sync on every insert/edit.
- Results: live posts only (deleted posts never show), newest first, 20 per page, with the same
  infinite scroll and no-JS "load more" as the feeds. The query stays in the URL (`/search?q=`).

### Hebrew prefixes

Hebrew glues one-letter prefixes (ו ה ב ל מ ש כ) onto words. Both sides compensate:

| Side  | What is matched                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Posts | every word as written, plus Hebrew words with **one** and **two** leading prefix letters stripped, as long as 3+ letters remain (`ובמערכת` is also indexed as `במערכת` and `מערכת`) |
| Query | each term as typed, plus (Hebrew, 4+ letters, starting with a prefix letter) the term without its first letter (`השרת` also searches `שרת`)                                         |

So `שרת` finds "השרת", `השרת` finds "שרת", and `מערכת` finds "ובמערכת".

### Query rules

- Terms are runs of letters/digits; everything else (quotes, `&`, `|`, `!`, `:`, punctuation)
  is a separator, so user input can never inject tsquery syntax. Niqqud is ignored.
- Terms shorter than 2 characters are dropped; at most 8 terms.
- Every term must match (AND); each term is a word prefix (`קוב` finds `קוברנטיס`).

## Limits (by design, for now)

- **False positives from prefix stripping**: a word that merely starts with a prefix letter
  also matches its stripped form, e.g. `שלום` also indexes `לום`, and `משק` matches inside
  `ממשק`. Requiring 3+ remaining letters keeps this rare; results are newest-first, not
  relevance-ranked, so noise is visible but bounded.
- **No stemming**: plural/gender/construct forms (`שרתים`, `שרתי`) only match as word
  prefixes of what was typed, not as the same lemma.
- **No typo tolerance / substring match**: that needs `pg_trgm`, pending PLAN.md open
  question 4. Nothing depends on it yet; if confirmed, add a trigram index in its own,
  clearly marked migration.
- **No relevance ranking**: newest first. `ts_rank` would need a different (non-keyset) cursor.
- Comments and user names are not searched.

## Query plans

`seed:large` (10k posts), warm cache:

| Query                      | Plan                                  | Time   |
| -------------------------- | ------------------------------------- | ------ |
| common word (`postgres`)   | index scan `posts_feed_idx`, filter   | 1.1 ms |
| rare Hebrew word (`השרת`)  | bitmap scan `posts_search_idx` + sort | ~2 ms  |
| two terms, mixed languages | bitmap scan `posts_search_idx` + sort | ~3 ms  |

The first version indexed the expression `z_search_vector(body)` without storing it; for rare
words the planner walked `posts_feed_idx` and recomputed the regex per row (146 ms). The
stored column fixed that.
