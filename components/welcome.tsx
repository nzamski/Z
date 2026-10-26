"use client";
// The mandatory first-login welcome: what Z is, pick a handle (+ bio), the current role (optional,
// docs/experience.md), then people to follow.
// Nothing else in Z is reachable until it is finished (requireViewer).
import { useActionState, useState } from "react";
import { finishOnboardingAction, saveExperienceAction } from "@/app/actions";
import { DatePick } from "@/components/date-pick";
import { ProfileForm } from "@/components/profile-form";
import { SuggestInput } from "@/components/suggest-input";
import { UserRow } from "@/components/user-row";
import { dayToMonth, LOCATION_MAX, TITLE_MAX, UNIT_MAX } from "@/lib/experience";
import { he } from "@/lib/i18n/he";
import type { Experience } from "@/lib/services";

type Person = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarSeed: string;
};

export function Welcome(p: {
  displayName: string; // from Keycloak, not editable
  profile: { handle: string; bio: string; avatarSeed: string };
  role?: Experience; // the current role, if one was saved already
  suggestions: Person[];
  next: string;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // Frozen at first render: each follow refreshes the page, and the fresh suggestions would leave
  // out whoever was just followed. Keeping the list lets the same button unfollow again.
  const [suggestions] = useState(p.suggestions);
  const finish = finishOnboardingAction.bind(null, p.next);
  return (
    <div className="space-y-6 px-4 py-8 text-start sm:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" aria-label={he.welcome.step(step, 3)}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 w-10 rounded-full transition-colors ${n <= step ? "bg-link" : "bg-neutral-200 dark:bg-neutral-800"}`}
            />
          ))}
          <span className="ms-2 text-xs text-muted">{he.welcome.step(step, 3)}</span>
        </div>
      </div>

      {step === 1 ? (
        <>
          <h1 className="text-3xl font-extrabold tracking-tight">{he.welcome.title}</h1>
          <ProfileForm
            displayName={p.displayName}
            initial={p.profile}
            submitLabel={he.welcome.next}
            onSaved={() => {
              setStep(2);
              window.scrollTo(0, 0);
            }}
          />
        </>
      ) : step === 2 ? (
        <RoleStep
          role={p.role}
          onDone={() => {
            setStep(3);
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <>
          <header className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">{he.welcome.followTitle}</h1>
            <p className="text-muted">{he.welcome.followHint}</p>
          </header>
          {suggestions.length ? (
            <ul className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 [&>li:last-child]:border-b-0">
              {suggestions.map((u) => (
                <UserRow key={u.id} user={u} viewerFollows={false} isSelf={false} />
              ))}
            </ul>
          ) : (
            <p className="text-muted">{he.welcome.noSuggestions}</p>
          )}
          <form action={finish}>
            <button className="w-full rounded-full bg-foreground py-3 text-lg font-bold text-background transition-opacity hover:opacity-85">
              {he.welcome.done}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

const field =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400";

/** The current role, as the first entry of the profile's experience. Skippable: only the handle is
 * required to finish the welcome. */
function RoleStep(p: { role?: Experience; onDone: () => void }) {
  const [v, setV] = useState({
    title: p.role?.title ?? "",
    unit: p.role?.unit ?? "",
    location: p.role?.location ?? "",
    start: p.role ? dayToMonth(p.role.startMonth) : "",
  });
  const year = new Date().getFullYear();
  const [state, action, pending] = useActionState(
    async (prev: { ok?: true; error?: string }, f: FormData) => {
      const r = await saveExperienceAction(prev, f);
      if (r.ok) p.onDone();
      return r;
    },
    {},
  );
  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{he.welcome.roleTitle}</h1>
        <p className="text-muted">{he.welcome.roleHint}</p>
      </header>
      <form action={action} className="space-y-4">
        {p.role && <input type="hidden" name="id" value={p.role.id} />}
        {/* Current: no end month (saveExperienceAction reads "current"). */}
        <input type="hidden" name="current" value="1" />
        <label className="block space-y-1">
          <span className="text-sm font-medium">{he.experience.role}</span>
          <SuggestInput
            kind="title"
            name="title"
            value={v.title}
            onChange={(e) => setV((c) => ({ ...c, title: e.target.value }))}
            required
            maxLength={TITLE_MAX}
            className={field}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{he.experience.unit}</span>
            <SuggestInput
              kind="unit"
              name="unit"
              value={v.unit}
              onChange={(e) => setV((c) => ({ ...c, unit: e.target.value }))}
              maxLength={UNIT_MAX}
              className={field}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{he.experience.location}</span>
            <input
              name="location"
              value={v.location}
              onChange={(e) => setV((c) => ({ ...c, location: e.target.value }))}
              maxLength={LOCATION_MAX}
              className={field}
            />
          </label>
        </div>
        <div className="space-y-1">
          <span className="block text-sm font-medium">{he.experience.start}</span>
          <DatePick
            month
            name="start"
            value={v.start}
            onChange={(start) => setV((c) => ({ ...c, start }))}
            fromYear={year - 60}
            toYear={year}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={pending || !v.title.trim() || !v.start}
            className="rounded-full bg-foreground px-5 py-2 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
          >
            {he.welcome.next}
          </button>
          <button
            type="button"
            onClick={p.onDone}
            className="rounded-full border border-neutral-300 px-5 py-2 font-medium transition-colors hover:bg-neutral-500/10 dark:border-neutral-700"
          >
            {he.welcome.skip}
          </button>
          {state.error && (
            <span role="alert" className="text-danger">
              {state.error}
            </span>
          )}
        </div>
      </form>
    </>
  );
}
