# Feed ranking

Code: `lib/feed.ts` (config, cursor, penalty, dedupe) and `feedPage()` in `lib/services.ts`.
Spec: PLAN.md §6.

## Views

| View                    | Order                        | Cursor                    | Window  |
| ----------------------- | ---------------------------- | ------------------------- | ------- |
| For You                 | `cursor_score DESC, id DESC` | `(feed_as_of, score, id)` | 30 days |
| Following (and you)     | `created_at DESC, id DESC`   | `id` (row's `created_at`) | none    |
| Newest (search, topics) | `created_at DESC, id DESC`   | `id`                      | none    |
| Most liked (topic sort) | `like_count DESC, id DESC`   | `(like_count, id)`        | none    |
| Profile (`/u/[handle]`) | `created_at DESC, id DESC`   | `id`                      | none    |

Home has two tabs, For You and Following (Latest and Top were removed: at pilot volume Latest
was For You in another order, and an all-time Top barely changes). Following includes your own
posts, so a new one shows at once. Most liked (`topPage`, index `posts_top_idx`) is a topic
page's sort: where useful posts on a subject stay findable. Like counts move while someone pages, so a post can repeat at a page boundary
(the client drops repeats) or be skipped (it is at most a page away). It has no new-posts pill.

The chosen tab is a cookie (`z_view`, one year), not part of the URL; an old `latest` / `top` falls back to For You. Pages are 20 posts. The cursor is opaque base64url JSON; a garbled one is a 400 from
`/api/feed` and a fresh first page on the server-rendered pages.

## For You formula

```
age_hours    = (feed_as_of - created_at) in hours
base         = (1 + likes + 0.5 * comments) / (age_hours + 2) ^ 1.5
boost        = 2.0 if the viewer follows the author, else 1.0
cursor_score = base * boost                      -- SQL order + cursor
penalty      = 0.7 ^ (n-1) for the nth post by the same author within the page
display      = page re-sorted by cursor_score * penalty
```

All constants live in `RANKING` in `lib/feed.ts`:

| Constant               | Value | Meaning                                            |
| ---------------------- | ----- | -------------------------------------------------- |
| `windowDays`           | 30    | For You only considers posts from the last 30 days |
| `commentWeight`        | 0.5   | A comment is worth half a like                     |
| `ageOffsetHours`       | 2     | Keeps brand-new posts from dividing by ~0          |
| `gravity`              | 1.5   | How fast posts sink with age                       |
| `followBoost`          | 2.0   | Posts by people you follow                         |
| `authorPenalty`        | 0.7   | Spreads one author's posts out within a page       |
| `pageSize`             | 20    |                                                    |
| `restoreMaxAgeMinutes` | 30    | Older sessionStorage snapshots start a fresh feed  |

**Provenance**: the shape is the well-known time-decay "gravity" ranking used by link
aggregators. The constants are untested guesses, not derived from data. The needs survey
(PLAN.md open question 3) has not run yet; calibrate with pilot usage.

## Cursor stability

- The first For You page fixes `feed_as_of`. Later pages reuse it for the age term and as a
  candidate filter (`created_at <= feed_as_of`), so new posts never enter a snapshot.
- The score goes into the cursor as a float8 and comes back as a float8. Postgres prints
  float8 with shortest round-trip digits and JS numbers are float64, so the value is exact.
  `tests/feed.test.ts` (a) fails if it is rounded.
- Like and comment counts are live, so a score can move between requests. The client dedupes
  by id (`mergeById`); rare gaps from mid-scroll engagement are accepted.
- Keyset views send only the last id and read its exact `created_at` from the row (JS `Date`
  would drop the microseconds). Soft-deleted rows stay, so the cursor row always exists.
- A reload starts a new snapshot. Back-navigation restores list and scroll position (Next's
  Activity cache keeps the last 3 routes; beyond that, the `sessionStorage` snapshot).
- After a Server Action calls `refresh()`, only the viewer's own posts published since the
  snapshot go on top; the visible list never re-sorts under the reader (following someone
  would otherwise reshuffle it).
- For You and Following poll `/api/feed/new` every 15 s (and when the tab becomes visible) for
  posts by others since the snapshot. The "show N new posts" pill puts those on top, followed by
  a fresh first page, and resets the snapshot. Clicking the Z logo on the home page reloads it.

## Query plans

Measured on `npm run seed:large` (200 users, 10k posts, 32k comments, 63k likes, 1k follows;
7.5k posts inside the For You window), Postgres 16 in docker on a laptop, warm cache,
`auto_explain` with `log_analyze`:

| Query                    | Plan                                             | Time   |
| ------------------------ | ------------------------------------------------ | ------ |
| For You, page 1          | seq scan of window + top-N heapsort              | 7.6 ms |
| For You, page 2          | bitmap scan on `posts_feed_idx` + top-N heapsort | 19 ms  |
| Following, page 1/2      | index scan `posts_feed_idx`, follows hashed      | 0.3 ms |
| Latest, page 1/2         | index scan `posts_feed_idx`                      | 0.2 ms |
| Profile                  | index scan `posts_author_idx`                    | 0.2 ms |
| Thread (227 roots, deep) | recursive CTE on `comments_thread_idx`           | 0.7 ms |

Found and fixed while measuring:

- drizzle's `.desc()` emits `DESC NULLS LAST`, but a plain `ORDER BY ... DESC` is
  `NULLS FIRST`, so Postgres ignored `posts_feed_idx` and sorted all 10k rows (3.8 ms). Both
  post indexes now use `.desc().nullsFirst()` (migration `0003_feed_index_order`).
- The seed now runs `ANALYZE`; before, estimates were off by ~70%.

**Ceiling**: For You scores every post in the window on every page, so it is linear in posts
per 30 days (page 2 is slower because the score is evaluated again for the cursor filter).
Fine at pilot scale. If it grows past ~50k posts per window, shrink the window or pre-filter
candidates (e.g. top N by `like_count` plus followed authors) before scoring.

To re-measure: `npm run seed:large`, enable `auto_explain` on the `z` database
(`session_preload_libraries`, `auto_explain.log_min_duration = 0`, `log_analyze = on`), run
`npx tsx --env-file-if-exists=.env scripts/explain-feeds.mts`, read `docker compose logs db`,
then `alter database z reset all`.
