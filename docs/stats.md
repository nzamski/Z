# Usage dashboard

Added 2026-10-22: `/admin/stats` (admins only; 404 for everyone else), linked from `/admin`.
Code: `lib/stats.ts` (queries), `app/admin/stats/page.tsx`, `components/bar-chart.tsx`.

Everything is computed when the page loads, from the existing tables. The one thing stored only
for it is **`daily_visits`**: one row per user per day they open Z (written by `requireViewer`,
at most one insert per user per day per server process). Nothing else about a visit (pages,
times, devices) is kept. Days are counted in `STATS_TIMEZONE` (`lib/limits.ts`, Asia/Jerusalem).

## What it shows (last 30 days)

- **People**: registered (finished the welcome; and how many signed in at all), active today,
  this week and this month (from visits), with the share of registered.
- **Conversation**: share of posts that got a comment from someone else; median time to that
  first comment; share of question-like posts (with "?") whose author liked an answer.
- **Daily charts**: active people, posts, comments, likes (post + comment likes still standing).
  Posts and comments count what was written, deleted later or not. Each bar has a tooltip and
  every chart has a table view.
- **Joined per week** (finished the welcome), the last 8 weeks.
- **Feature use** (distinct people): created a poll, voted, tagged a topic, mentioned someone,
  saved something, pinned a post, marked an answer (liked a comment on their post), reported.
  Desktop notifications can't be counted: that setting lives only in the browser.
- **Top topics** and **top contributors** (posts + comments, the likes they got, and how many of
  their comments a post's author liked). The contributor list was requested; it names people.

## Cost

About 300 ms on `seed:large` (10k posts, 32k comments) with a warm cache; fine for a page only
admins open. If it ever gets slow, the daily series can move to a nightly rollup table.
