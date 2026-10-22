"use client";
// Avatar (shuffled here, saved with the rest), display name (read-only, from Keycloak), handle, bio and profession badge, used by the first-login welcome and by "edit profile".
// The handle is checked live (format here, availability on the server) as you type.
import { useActionState, useEffect, useRef, useState } from "react";
import { checkHandleAction, updateProfileAction, type ProfileResult } from "@/app/actions";
import { AvatarImage } from "@/components/avatar";
import { LengthRing } from "@/components/composer";
import { newAvatarSeed } from "@/lib/avatar";
import { he } from "@/lib/i18n/he";
import { BIO_MAX, HANDLE_MAX, HANDLE_RE } from "@/lib/limits";
import { PROFESSION_COLOR, PROFESSION_LABEL, PROFESSIONS } from "@/lib/professions";

type Profile = { handle: string; bio: string; profession?: string | null; avatarSeed: string };
type Status = "ok" | "taken" | "invalid" | "checking" | "same" | "empty";

const field =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400";

export function ProfileForm(p: {
  displayName: string; // from Keycloak: shown, never editable
  initial: Profile;
  submitLabel: string;
  onSaved: (handle: string) => void;
  saveAtEnd?: boolean; // the button at the far (left) end: the edit-profile popup
}) {
  const [handle, setHandle] = useState(p.initial.handle);
  const [bio, setBio] = useState(p.initial.bio);
  const [profession, setProfession] = useState(p.initial.profession ?? "");
  const [avatarSeed, setAvatarSeed] = useState(p.initial.avatarSeed);
  // Keep anything typed before hydration (slow loads), which React state would otherwise miss.
  const handleRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (handleRef.current) setHandle(handleRef.current.value.toLowerCase());
    if (bioRef.current) setBio(bioRef.current.value);
  }, []);
  // Format and "unchanged" are known locally; availability comes from the server, debounced.
  const h = handle.trim().toLowerCase();
  const local: Status | null = !h
    ? "empty" // first-time setup: no handle yet
    : h === p.initial.handle
      ? "same"
      : HANDLE_RE.test(h)
        ? null
        : "invalid";
  const [checked, setChecked] = useState<{ h: string; r: "ok" | "taken" | "invalid" }>();
  const status: Status = local ?? (checked?.h === h ? checked.r : "checking");
  useEffect(() => {
    if (local) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await checkHandleAction(h);
      if (live) setChecked({ h, r });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [h, local]);

  const [state, action, pending] = useActionState(async (prev: ProfileResult, f: FormData) => {
    const r = await updateProfileAction(prev, f);
    if (r.ok && r.handle) p.onSaved(r.handle);
    return r;
  }, {});

  const blocked =
    pending ||
    bio.length > BIO_MAX ||
    status === "taken" ||
    status === "empty" ||
    status === "invalid" ||
    status === "checking";
  const hint = {
    ok: <span className="text-emerald-700 dark:text-emerald-400">✓ {he.profile.handleOk}</span>,
    taken: <span className="text-danger">{he.profile.handleTaken}</span>,
    invalid: <span className="text-danger">{he.profile.handleRules}</span>,
    checking: <span className="text-muted">{he.profile.handleChecking}</span>,
    same: <span className="text-muted">{he.profile.handleRules}</span>,
    empty: <span className="text-muted">{he.profile.handleRules}</span>,
  }[status];

  return (
    <form action={action} className="space-y-4 text-start">
      <div className="flex items-center gap-4">
        <AvatarImage seed={avatarSeed} className="size-16" />
        <input type="hidden" name="avatarSeed" value={avatarSeed} />
        <button
          type="button"
          onClick={() => setAvatarSeed(newAvatarSeed())}
          aria-label={`${he.profile.shuffle}: ${he.profile.avatar}`}
          className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-500/10 dark:border-neutral-700"
        >
          {/* Lucide-style "shuffle" arrows. */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m18 14 4 4-4 4M18 2l4 4-4 4M2 18h1.97a4 4 0 0 0 3.3-1.7l5.46-8.6A4 4 0 0 1 16.03 6H22M2 6h1.97a4 4 0 0 1 3.3 1.7l.43.67M22 18h-5.97a4 4 0 0 1-3.3-1.7l-.43-.67" />
          </svg>
          {he.profile.shuffle}
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{he.profile.displayName}</span>
        <input
          value={p.displayName}
          readOnly
          aria-describedby="display-name-hint"
          className={`${field} cursor-not-allowed bg-neutral-500/10 text-muted`}
        />
        <span id="display-name-hint" className="block text-xs text-muted">
          {he.profile.displayNameHint}
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{he.profile.handle}</span>
        <span
          className="flex items-center rounded-md border border-neutral-300 focus-within:border-neutral-500 dark:border-neutral-700 dark:focus-within:border-neutral-400"
          dir="ltr"
        >
          <span className="ps-3 text-muted">@</span>
          <input
            name="handle"
            ref={handleRef}
            value={handle}
            onChange={(e) => setHandle(e.target.value.toLowerCase())}
            maxLength={HANDLE_MAX}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="handle-hint"
            className="w-full bg-transparent py-2 pe-3 outline-none"
          />
        </span>
        <span id="handle-hint" aria-live="polite" className="block text-xs">
          {hint}
        </span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{he.profile.bio}</span>
        <textarea
          name="bio"
          ref={bioRef}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder={he.profile.bioPlaceholder}
          className={`${field} block resize-none`}
        />
        <span className="flex justify-end text-xs">
          <LengthRing length={bio.length} max={BIO_MAX} alwaysCount />
        </span>
      </label>
      <div className="space-y-1.5">
        <span id="profession-label" className="block text-sm font-medium">
          {he.profile.profession}
        </span>
        <input type="hidden" name="profession" value={profession} />
        {/* Chips, one at a time; the chosen one in its badge color. Again to unpick. */}
        <div role="radiogroup" aria-labelledby="profession-label" className="flex flex-wrap gap-2">
          {PROFESSIONS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={profession === v}
              onClick={() => setProfession((cur) => (cur === v ? "" : v))}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                profession === v
                  ? `border-transparent font-medium ${PROFESSION_COLOR[v]}`
                  : "border-neutral-300 hover:bg-neutral-500/10 dark:border-neutral-700"
              }`}
            >
              {PROFESSION_LABEL[v]}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`flex items-center gap-3 text-sm ${p.saveAtEnd ? "flex-row-reverse justify-start" : ""}`}
      >
        <button
          disabled={blocked}
          className="rounded-full bg-foreground px-5 py-2 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
        >
          {p.submitLabel}
        </button>
        {state.error && (
          <span role="alert" className="text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
