// Load test for the For You feed, the one query that scans its whole 30-day window
// (docs/ranking.md, "Ceiling"). Calls feedPage() directly, as many viewers at once, against the
// dev DB; no HTTP or auth, so it measures the query and the service layer, not Next rendering.
// Usage: see docs/ranking.md ("Load test").
//   npx tsx --env-file-if-exists=.env scripts/load-feeds.mts [concurrency=20] [seconds=30] [p95BudgetMs=200]
import { sql as raw } from "@/db/client";
import { feedPage } from "@/lib/services";

const [concurrency = 20, seconds = 30, budget = 200] = process.argv.slice(2).map(Number);

const viewers = (
  await raw<{ id: string }[]>`select id from users where deleted_at is null limit 500`
).map((u) => u.id);
const [{ n: windowPosts }] = await raw<{ n: number }[]>`
  select count(*)::int n from posts where deleted_at is null and created_at > now() - interval '30 days'`;
if (viewers.length === 0) throw new Error("No users: run `npm run seed:large` first");

const times: number[] = [];
let errors = 0;
const end = Date.now() + seconds * 1000;

async function user(i: number) {
  for (let n = i; Date.now() < end; n += concurrency) {
    const viewerId = viewers[n % viewers.length];
    // Page 1, then page 2 (re-scores the window for the cursor filter, the slower one).
    let cursor: string | null = null;
    for (let page = 0; page < 2; page++) {
      const t = performance.now();
      try {
        cursor = (await feedPage(viewerId, { view: "forYou", cursor })).next;
        times.push(performance.now() - t);
      } catch (e) {
        errors++;
        console.error(e);
      }
      if (!cursor) break;
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, (_, i) => user(i)));
await raw.end();

times.sort((a, b) => a - b);
const pct = (p: number) => times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))];
const p95 = pct(95);
console.log(
  `${windowPosts} posts in window, ${viewers.length} viewers, ${concurrency} concurrent, ${seconds}s`,
);
console.log(
  `${times.length} requests (${(times.length / seconds).toFixed(1)}/s), ${errors} errors; ` +
    `p50 ${pct(50).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, p99 ${pct(99).toFixed(1)} ms, max ${times.at(-1)!.toFixed(1)} ms`,
);
if (errors > 0 || p95 > budget) {
  console.error(`FAIL: p95 budget ${budget} ms`);
  process.exit(1);
}
