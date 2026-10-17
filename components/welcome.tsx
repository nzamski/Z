"use client";
// The mandatory first-login welcome: what Z is, pick a handle (+ bio), then people to follow.
// Nothing else in Z is reachable until it is finished (requireViewer).
import { useState } from "react";
import { finishOnboardingAction } from "@/app/actions";
import { ProfileForm } from "@/components/profile-form";
import { UserRow } from "@/components/user-row";
import { he } from "@/lib/i18n/he";

type Person = { id: string; handle: string; displayName: string; bio: string };

export function Welcome(p: {
  displayName: string; // from Keycloak, not editable
  profile: { handle: string; bio: string };
  suggestions: Person[];
  next: string;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  // Frozen at first render: each follow refreshes the page, and the fresh suggestions would leave
  // out whoever was just followed. Keeping the list lets the same button unfollow again.
  const [suggestions] = useState(p.suggestions);
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
