"use client";
// Polls (docs/polls.md), X-style: the post's text is the question. Until you vote (and while it's
// open) the options are buttons; after voting, when it ends, or on your own poll: the results.
import { startTransition, useOptimistic, useState } from "react";
import { votePollAction } from "@/app/actions";
import { until } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { POLL_DAYS, POLL_OPTION_MAX, POLL_OPTIONS_MAX } from "@/lib/limits";
import type { PollView } from "@/lib/services";

/** Bar chart: the composer's poll button. */
export function PollIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 6h10M4 12h16M4 18h7" />
    </svg>
  );
}

/** The composer's poll box: option fields (2 to POLL_OPTIONS_MAX) and the duration. Sent with the
 * post's form as pollOption (each) and pollDays. `onChange(null)` removes the poll. */
export function PollFields(p: { options: string[]; onChange: (o: string[] | null) => void }) {
  const T = he.poll;
  // Controlled: React resets a form's uncontrolled fields after every submit, failed ones too.
  const [days, setDays] = useState(POLL_DAYS[0]);
  const set = (i: number, v: string | null) =>
    p.onChange(v === null ? p.options.filter((_, j) => j !== i) : p.options.with(i, v));
  return (
    <fieldset className="mt-2 space-y-2 rounded-2xl border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      <legend className="sr-only">{he.composer.poll}</legend>
      {p.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            name="pollOption"
            value={o}
            onChange={(e) => set(i, e.target.value)}
            maxLength={POLL_OPTION_MAX}
            placeholder={T.option(i + 1)}
            aria-label={T.option(i + 1)}
            autoFocus={i === 0}
            className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-transparent px-3 py-2 outline-none focus:border-sky-500 dark:border-neutral-800 dark:focus:border-sky-500"
          />
          {p.options.length > 2 && (
            <button
              type="button"
              onClick={() => set(i, null)}
              aria-label={T.removeOption}
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-neutral-500/10 hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {p.options.length < POLL_OPTIONS_MAX ? (
          <button
            type="button"
            onClick={() => p.onChange([...p.options, ""])}
            className="font-medium text-link hover:underline"
          >
            + {T.addOption}
          </button>
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 text-muted">
          {T.duration}
          <select
            name="pollDays"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md bg-neutral-500/10 px-2 py-1 text-foreground outline-none"
          >
            {POLL_DAYS.map((d) => (
              <option key={d} value={d}>
                {T.days(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={() => p.onChange(null)}
        className="w-full rounded-lg py-1.5 text-danger hover:bg-red-500/10"
      >
        {T.remove}
      </button>
    </fieldset>
  );
}

/** A post's poll. `canVote`: a logged-in reader who isn't its author. */
export function Poll({
  postId,
  poll,
  canVote,
}: {
  postId: string;
  poll: PollView;
  canVote: boolean;
}) {
  const T = he.poll;
  // The vote shows at once; the action's refresh then brings the real counts.
  const [view, vote] = useOptimistic(poll, (v, option: number) => ({
    ...v,
    mine: option,
    counts: v.counts.with(option, v.counts[option] + 1),
  }));
  const [error, setError] = useState<string>();
  const total = view.counts.reduce((a, b) => a + b, 0);
  const results = !canVote || !view.open || view.mine !== null;

  return (
    <div className="mt-3 space-y-2 text-sm">
      {view.options.map((o, i) =>
        results ? (
          <div key={i} className="relative flex items-center justify-between gap-3 px-3 py-1.5">
            <span
              aria-hidden
              style={{ width: `${total ? (view.counts[i] / total) * 100 : 0}%` }}
              className={`absolute inset-y-0 start-0 rounded-md ${view.mine === i ? "bg-sky-500/30" : "bg-neutral-500/15"}`}
            />
            <span className={`relative truncate ${view.mine === i ? "font-bold" : ""}`}>
              <bdi>{o}</bdi>
              {view.mine === i && (
                <span className="ms-1.5 text-sky-500" aria-label={T.yours}>
                  ✓
                </span>
              )}
            </span>
            <span className={`relative ${view.mine === i ? "font-bold" : ""}`}>
              {total ? Math.round((view.counts[i] / total) * 100) : 0}%
            </span>
          </div>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() =>
              startTransition(async () => {
                setError(undefined);
                vote(i);
                const r = await votePollAction(postId, i);
                if (r.error) setError(r.error);
              })
            }
            className="block w-full truncate rounded-full border border-sky-500 px-3 py-1.5 font-bold text-sky-600 transition-colors hover:bg-sky-500/10 dark:text-sky-400"
          >
            <bdi>{o}</bdi>
          </button>
        ),
      )}
      <p className="text-muted">
        {T.votes(total)} · {view.open ? T.left(until(new Date(view.endsAt))) : T.ended}
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
