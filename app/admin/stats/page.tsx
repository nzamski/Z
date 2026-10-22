import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { BarChart } from "@/components/bar-chart";
import { Loading } from "@/components/loading";
import { requireAdmin } from "@/lib/auth/viewer";
import { he } from "@/lib/i18n/he";
import { STATS_DAYS, usageStats } from "@/lib/stats";
import type { Metadata } from "next";

const T = he.stats;
const heading =
  "border-b border-neutral-200 px-4 py-3 text-start text-lg font-bold dark:border-neutral-800";
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function Tile(p: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-3 text-start dark:border-neutral-800">
      <div className="text-sm text-muted">{p.label}</div>
      <div className="text-2xl font-bold tabular-nums">{p.value}</div>
      {p.hint && <div className="text-xs text-muted">{p.hint}</div>}
    </div>
  );
}

// Usage dashboard (docs/stats.md): admins only (404 otherwise), computed on each visit.
async function Stats() {
  await connection();
  await requireAdmin();
  const s = await usageStats();
  const c = s.conversation;
  const features: [string, number][] = [
    [T.features.polls, s.features.polls],
    [T.features.voters, s.features.voters],
    [T.features.topics, s.features.topics],
    [T.features.mentions, s.features.mentions],
    [T.features.bookmarks, s.features.bookmarks],
    [T.features.pins, s.features.pins],
    [T.features.answers, s.features.answers],
    [T.features.reports, s.features.reports],
  ];
  return (
    <>
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 className="text-lg font-bold">{T.title}</h1>
        <Link href="/admin" className="text-sm text-link hover:underline">
          → {he.moderation.title}
        </Link>
      </div>
      <p className="px-4 pt-3 text-start text-sm text-muted">{T.period(STATS_DAYS)}</p>

      <section aria-label={T.people} className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <Tile
          label={T.registered}
          value={s.people.onboarded}
          hint={T.signedIn(s.people.registered)}
        />
        <Tile label={T.today} value={s.active.today} />
        <Tile label={T.week} value={s.active.week} hint={pct(s.active.week, s.people.onboarded)} />
        <Tile
          label={T.month}
          value={s.active.month}
          hint={pct(s.active.month, s.people.onboarded)}
        />
        <Tile label={T.replied} value={pct(c.commented, c.posts)} hint={T.ofPosts(c.posts)} />
        <Tile
          label={T.firstReply}
          value={c.medianMinutes === null ? "—" : T.duration(c.medianMinutes)}
        />
        <Tile
          label={T.answered}
          value={pct(c.answered, c.questions)}
          hint={T.ofQuestions(c.questions)}
        />
      </section>

      <section aria-label={T.activity} className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
        <BarChart id="chart-visits" title={T.charts.visits} data={s.visits} />
        <BarChart id="chart-posts" title={T.charts.posts} data={s.posts} />
        <BarChart id="chart-comments" title={T.charts.comments} data={s.comments} />
        <BarChart id="chart-likes" title={T.charts.likes} data={s.likes} />
      </section>

      <section aria-labelledby="new-users">
        <h2 id="new-users" className={heading}>
          {T.newUsers}
        </h2>
        {s.newUsers.length ? (
          <ul className="px-4 py-3 text-start text-sm tabular-nums">
            {s.newUsers.map((w) => (
              <li key={w.week}>
                {T.weekOf(w.week.split("-").reverse().slice(0, 2).join("."), w.n)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-start text-sm text-muted">{T.none}</p>
        )}
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className={heading}>
          {T.featuresTitle}
        </h2>
        <table className="w-full text-start text-sm tabular-nums">
          <tbody>
            {features.map(([label, n]) => (
              <tr key={label} className="border-b border-neutral-200 dark:border-neutral-800">
                <td className="px-4 py-2">{label}</td>
                <td className="px-4 py-2 font-bold">{n}</td>
                <td className="px-4 py-2 text-muted">{pct(n, s.active.month)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-start text-xs text-muted">{T.featuresHint}</p>
      </section>

      <section aria-labelledby="top-topics">
        <h2 id="top-topics" className={heading}>
          {T.topTopics}
        </h2>
        {s.topics.length ? (
          <ol className="flex flex-wrap gap-2 px-4 py-3 text-sm">
            {s.topics.map((t) => (
              <li key={t.tag}>
                <Link
                  href={`/t/${encodeURIComponent(t.tag)}`}
                  className="rounded-full bg-neutral-500/10 px-3 py-1 hover:underline"
                >
                  #{t.tag} <span className="text-muted tabular-nums">{t.posts}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-4 py-3 text-start text-sm text-muted">{T.none}</p>
        )}
      </section>

      <section aria-labelledby="contributors">
        <h2 id="contributors" className={heading}>
          {T.contributors}
        </h2>
        {s.contributors.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm tabular-nums">
              <thead className="text-muted">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-4 py-2 text-start font-normal">{T.cols.person}</th>
                  <th className="px-2 py-2 text-start font-normal">{T.cols.posts}</th>
                  <th className="px-2 py-2 text-start font-normal">{T.cols.comments}</th>
                  <th className="px-2 py-2 text-start font-normal">{T.cols.likes}</th>
                  <th className="px-2 py-2 text-start font-normal">{T.cols.answers}</th>
                </tr>
              </thead>
              <tbody>
                {s.contributors.map((p) => (
                  <tr
                    key={p.handle}
                    className="border-b border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2">
                      <Link href={`/u/${encodeURIComponent(p.handle)}`} className="hover:underline">
                        <b>{p.displayName}</b>{" "}
                        <span className="text-muted" dir="ltr">
                          @{p.handle}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2">{p.posts}</td>
                    <td className="px-2 py-2">{p.comments}</td>
                    <td className="px-2 py-2">{p.likes}</td>
                    <td className="px-2 py-2">{p.answers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-3 text-start text-sm text-muted">{T.none}</p>
        )}
      </section>
    </>
  );
}

export const metadata: Metadata = { title: he.titles.stats };

export default function Page() {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Stats />
      </Suspense>
    </main>
  );
}
