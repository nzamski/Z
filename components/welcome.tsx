"use client";
// The mandatory first-login welcome: what Z is, pick a handle (+ bio), then people to follow.
// Nothing else in Z is reachable until it is finished (requireViewer).
import { useState } from "react";
import { finishOnboardingAction } from "@/app/actions";
import { ProfileForm } from "@/components/profile-form";
import { UserRow } from "@/components/user-row";
import { he } from "@/lib/i18n/he";

type Person = { id: string; handle: string; displayName: string; bio: string };

const ICONS = [
  // pen: share
  "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  // person+: follow
  "M15 19a6 6 0 0 0-12 0M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6",
  // bubble: talk
  "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
];

export function Welcome(p: {
  displayName: string; // from Keycloak, not editable
  profile: { handle: string; bio: string };
  suggestions: Person[];
  next: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const finish = finishOnboardingAction.bind(null, p.next);
  return (
    <div className="space-y-6 px-4 py-8 text-start sm:px-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" aria-label={he.welcome.step(step, 2)}>
          {[1, 2].map((n) => (
            <span
              key={n}
              className={`h-1.5 w-10 rounded-full transition-colors ${n <= step ? "bg-link" : "bg-neutral-200 dark:bg-neutral-800"}`}
            />
          ))}
          <span className="ms-2 text-xs text-muted">{he.welcome.step(step, 2)}</span>
        </div>
      </div>

      {step === 1 ? (
        <>
          <header className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight">{he.welcome.title}</h1>
            <p className="text-lg text-muted">{he.welcome.intro}</p>
          </header>
          <ul className="grid gap-3 sm:grid-cols-3">
            {he.welcome.points.map(([title, text], i) => (
              <li
                key={title}
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="mb-2 size-6 text-link"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={ICONS[i]} />
                </svg>
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
          <section className="space-y-4 rounded-xl border border-neutral-200 p-4 sm:p-6 dark:border-neutral-800">
            <div>
              <h2 className="text-xl font-bold">{he.welcome.profileTitle}</h2>
              <p className="text-sm text-muted">{he.welcome.profileHint}</p>
            </div>
            <div className="rounded-lg bg-neutral-500/10 px-3 py-2 text-sm">
              <span className="text-muted">{he.welcome.nameFrom} </span>
              <b>{p.displayName}</b>
            </div>
            <ProfileForm
              initial={p.profile}
              submitLabel={he.welcome.next}
              onSaved={() => {
                setStep(2);
                window.scrollTo(0, 0);
              }}
            />
          </section>
        </>
      ) : (
        <>
          <header className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">{he.welcome.followTitle}</h1>
            <p className="text-muted">{he.welcome.followHint}</p>
          </header>
          {p.suggestions.length ? (
            <ul className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 [&>li:last-child]:border-b-0">
              {p.suggestions.map((u) => (
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
