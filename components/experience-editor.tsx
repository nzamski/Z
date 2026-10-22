"use client";
// Add or edit a role in your experience (docs/experience.md), in a modal like "edit profile":
// native <dialog> (Esc closes, focus stays inside). The server checks everything again.
import { useActionState, useRef, useState, useTransition } from "react";
import { deleteExperienceAction, saveExperienceAction } from "@/app/actions";
import { DatePick } from "@/components/date-pick";
import { dayToMonth, ORGANIZATION_MAX, TITLE_MAX } from "@/lib/experience";
import { he } from "@/lib/i18n/he";
import type { Experience } from "@/lib/services";

const field =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400";

export function ExperienceEditor({ entry }: { entry?: Experience }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(0); // remount the form on each open: fresh fields
  const close = () => dialog.current?.close();
  const label = entry ? he.experience.edit : he.experience.add;
  return (
    <>
      <button
        onClick={() => {
          setOpen((n) => n + 1);
          dialog.current?.showModal();
        }}
        aria-label={label}
        data-tip={label}
        className="grid size-8 shrink-0 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={entry ? "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" : "M12 5v14M5 12h14"} />
        </svg>
      </button>
      <dialog
        ref={dialog}
        aria-label={label}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="space-y-4 p-5 text-start sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{label}</h2>
            <button
              onClick={close}
              aria-label={he.composer.cancel}
              data-tip={he.composer.cancel}
              className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          {open > 0 && <ExperienceForm key={open} entry={entry} onDone={close} />}
        </div>
      </dialog>
    </>
  );
}

function ExperienceForm({ entry, onDone }: { entry?: Experience; onDone: () => void }) {
  const [v, setV] = useState({
    title: entry?.title ?? "",
    organization: entry?.organization ?? "",
    start: entry ? dayToMonth(entry.startMonth) : "",
    end: entry?.endMonth ? dayToMonth(entry.endMonth) : "",
    current: entry ? !entry.endMonth : true,
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));
  const year = new Date().getFullYear();
  const [state, action, pending] = useActionState(
    async (prev: { ok?: true; error?: string }, f: FormData) => {
      const r = await saveExperienceAction(prev, f);
      if (r.ok) onDone();
      return r;
    },
    {},
  );
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();
  const label = (text: string, input: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{text}</span>
      {input}
    </label>
  );
  return (
    <form action={action} className="space-y-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {label(
        he.experience.role,
        <input
          name="title"
          value={v.title}
          onChange={set("title")}
          required
          maxLength={TITLE_MAX}
          className={field}
        />,
      )}
      {label(
        he.experience.organization,
        <input
          name="organization"
          value={v.organization}
          onChange={set("organization")}
          maxLength={ORGANIZATION_MAX}
          className={field}
        />,
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="current"
          checked={v.current}
          onChange={(e) => setV((cur) => ({ ...cur, current: e.target.checked }))}
        />
        {he.experience.current}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Month and year as Z's own dropdowns (DatePick); a div, not a label, around buttons. */}
        <div className="space-y-1">
          <span className="block text-sm font-medium">{he.experience.start}</span>
          <DatePick
            month
            name="start"
            value={v.start}
            onChange={(start) => setV((cur) => ({ ...cur, start }))}
            fromYear={year - 60}
            toYear={year}
          />
        </div>
        {!v.current && (
          <div className="space-y-1">
            <span className="block text-sm font-medium">{he.experience.end}</span>
            <DatePick
              month
              name="end"
              value={v.end}
              onChange={(end) => setV((cur) => ({ ...cur, end }))}
              fromYear={year - 60}
              toYear={year}
            />
          </div>
        )}
      </div>
      <div className="flex flex-row-reverse items-center justify-start gap-3 text-sm">
        <button
          disabled={pending || deleting || !v.start || (!v.current && !v.end)}
          className="rounded-full bg-foreground px-5 py-2 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
        >
          {he.composer.save}
        </button>
        {entry && (
          <button
            type="button"
            disabled={pending || deleting}
            onClick={() =>
              startDelete(async () => {
                const r = await deleteExperienceAction(entry.id);
                if (r.ok) onDone();
                else setDeleteError(r.error);
              })
            }
            className="rounded-full px-4 py-2 text-danger transition-colors hover:bg-red-500/10 disabled:opacity-40"
          >
            {he.experience.delete}
          </button>
        )}
        {(state.error || deleteError) && (
          <span role="alert" className="text-danger">
            {state.error || deleteError}
          </span>
        )}
      </div>
    </form>
  );
}
