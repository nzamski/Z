# Search

Code: `lib/search.ts` (query builder, fuzzy thresholds), `feedPage({ query })`, `similarPosts()`
and `searchUsers()` in `lib/services.ts`, page `app/search/page.tsx`, SQL in
`drizzle/0005_search.sql` (function), `drizzle/0006_search_column.sql` (column + index) and
`drizzle/0009_trgm.sql` (pg_trgm).

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
- **Typo tolerance is a fallback only** (see pg_trgm below): it kicks in when full-text search
  finds nothing, shows one page, and is not paged.
- **No relevance ranking**: newest first. `ts_rank` would need a different (non-keyset) cursor.
- Comments are not searched.

## pg_trgm (migration 0009)

Confirmed available on the managed Postgres (2026-10-19). The migration runs
`CREATE EXTENSION IF NOT EXISTS pg_trgm` (a trusted extension: the database owner may create it).

- **People search** (`searchUsers`): handle or display name contains the query (ILIKE, literal:
  `%`/`_` are escaped), or is close to it (`word_similarity >= 0.4`, for 3+ characters). Order:
  exact handle, handle prefix, closest, most followed. Indexes: `users_handle_trgm_idx`,
  `users_display_name_trgm_idx`. It also matches the title and unit of a person's live roles the
  same way (after name matches in the order; `experiences_title_trgm_idx`,
  `experiences_unit_trgm_idx`, migration 0034; docs/experience.md).
- **Post search fallback** (`similarPosts`): when full-text search returns nothing on the first
  page, the page shows up to 20 live posts with `word_similarity(query, body) >= 0.5`, best
  first, under "no exact matches". Index: `posts_body_trgm_idx`.
- Thresholds live in `FUZZY` (`lib/search.ts`). The `<%` operator reads the threshold from a
  setting, so each query sets it with `set_config(..., true)` inside its own transaction.

**Locale requirement**: pg_trgm only sees letters the database's `LC_CTYPE` classifies as
alphanumeric. With `C.UTF-8`, `he_IL.UTF-8` or `en_US.UTF-8` Hebrew works; with plain `C`, every
Hebrew letter is dropped and fuzzy matching silently finds nothing for Hebrew (ILIKE substring
and full-text search are unaffected). Check with:

```sql
SELECT datctype FROM pg_database WHERE datname = current_database();
SELECT show_trgm('שלום');  -- must not be {}
```

## Query plans

`seed:large` (10k posts), warm cache:

| Query                      | Plan                                  | Time   |
| -------------------------- | ------------------------------------- | ------ |
| common word (`postgres`)   | index scan `posts_feed_idx`, filter   | 1.1 ms |
| rare Hebrew word (`השרת`)  | bitmap scan `posts_search_idx` + sort | ~2 ms  |
| two terms, mixed languages | bitmap scan `posts_search_idx` + sort | ~3 ms  |

| fuzzy fallback (`קוברנטס`) | bitmap scan `posts_body_trgm_idx` | 0.8 ms |

The first version indexed the expression `z_search_vector(body)` without storing it; for rare
words the planner walked `posts_feed_idx` and recomputed the regex per row (146 ms). The
stored column fixed that.
