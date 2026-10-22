"use client";
// Polls (docs/polls.md), X-style: the post's text is the question. Until you vote (and while it's
// open) the options are buttons; after voting, when it ends, or on your own poll: the results.
import { startTransition, useEffect, useOptimistic, useState } from "react";
import { votePollAction } from "@/app/actions";
import { until } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { useMenu } from "@/components/theme-menu";
import { POLL_MINUTES, POLL_OPTION_MAX, POLL_OPTIONS_MAX } from "@/lib/limits";
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

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const MAX_DAYS = POLL_MINUTES.max / (24 * 60);

const LIST_H = 200; // px: the list's max-h-48 and its margin

/** A duration part (days, hours, minutes): Z's own dropdown, not the browser's. Fixed to the
 * screen (like the emoji picker), so the new-post popup's edge doesn't cut it off; above the
 * button when there's no room below. */
function Pick(p: { label: string; value: number; values: number[]; onPick: (v: number) => void }) {
  const { open, setOpen, root } = useMenu();
  const [at, setAt] = useState({ top: 0, left: 0, width: 0 });
  // Fixed to the screen: scrolling the page would leave it behind, so that closes it (scrolling
  // the list itself doesn't).
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("scroll", close, true);
    return () => removeEventListener("scroll", close, true);
  }, [open, root, setOpen]);
  const disabled = p.values.length < 2;
  return (
    <div ref={root} className="relative flex-1">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({
            top: innerHeight - r.bottom >= LIST_H ? r.bottom + 4 : r.top - LIST_H,
            left: r.left,
            width: r.width,
          });
          setOpen((o) => !o);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-start transition-colors enabled:hover:border-neutral-400 disabled:opacity-50 aria-expanded:border-sky-500 dark:border-neutral-800 dark:enabled:hover:border-neutral-600 dark:aria-expanded:border-sky-500"
      >
        <span>
          <span className="block text-xs text-muted">{p.label}</span>
          <span className="text-base">{p.value}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={p.label}
          style={at}
          className="fixed z-30 max-h-48 overflow-y-auto rounded-xl border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800"
        >
          {p.values.map((v) => (
            <li key={v}>
              <button
                type="button"
                role="option"
                aria-selected={v === p.value}
                // The chosen one starts in view.
                ref={(el) => void (v === p.value && el?.scrollIntoView({ block: "nearest" }))}
                onClick={() => {
                  p.onPick(v);
                  setOpen(false);
                }}
                className="w-full px-3 py-1.5 text-start transition-colors hover:bg-neutral-500/10 aria-selected:font-bold aria-selected:text-sky-500"
              >
                {v}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The composer's poll box: option fields (2 to POLL_OPTIONS_MAX) and the duration (days, hours,
 * minutes: 5 minutes to 7 days). Sent with the post's form as pollOption (each) and pollMinutes.
 * `onChange(null)` removes the poll. */
export function PollFields(p: { options: string[]; onChange: (o: string[] | null) => void }) {
  const T = he.poll;
  const [time, setTime] = useState({ d: POLL_MINUTES.default / (24 * 60), h: 0, m: 0 });
  // Kept within the limits: the longest is exactly 7 days, the shortest 5 minutes.
  const pick = (part: Partial<typeof time>) => {
    const t = { ...time, ...part };
    if (t.d === MAX_DAYS) t.h = t.m = 0;
    if (!t.d && !t.h && t.m < POLL_MINUTES.min) t.m = POLL_MINUTES.min;
    setTime(t);
  };
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
      {p.options.length < POLL_OPTIONS_MAX && (
        <button
          type="button"
          onClick={() => p.onChange([...p.options, ""])}
          className="font-medium text-link hover:underline"
        >
          + {T.addOption}
        </button>
      )}
      <div className="border-t border-neutral-200 pt-2 dark:border-neutral-800">
        <div className="mb-1.5 text-muted">{T.duration}</div>
        <input type="hidden" name="pollMinutes" value={time.d * 24 * 60 + time.h * 60 + time.m} />
        <div className="flex gap-2">
          <Pick
            label={T.days}
            value={time.d}
            values={range(0, MAX_DAYS)}
            onPick={(d) => pick({ d })}
          />
          <Pick
            label={T.hours}
            value={time.h}
            values={time.d === MAX_DAYS ? [0] : range(0, 23)}
            onPick={(h) => pick({ h })}
          />
          <Pick
            label={T.minutes}
            value={time.m}
            values={
              time.d === MAX_DAYS ? [0] : range(!time.d && !time.h ? POLL_MINUTES.min : 0, 55, 5)
            }
            onPick={(m) => pick({ m })}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => p.onChange(null)}
        className="w-full rounded-lg border-t border-neutral-200 pt-2 pb-1 text-danger hover:bg-red-500/10 dark:border-neutral-800"
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
