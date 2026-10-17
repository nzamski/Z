"use client";
// Display name (read-only, from Keycloak), handle and bio, used by the first-login welcome and by "edit profile".
// The handle is checked live (format here, availability on the server) as you type.
import { useActionState, useEffect, useRef, useState } from "react";
import { checkHandleAction, updateProfileAction, type ProfileResult } from "@/app/actions";
import { LengthRing } from "@/components/composer";
import { he } from "@/lib/i18n/he";
import { BIO_MAX, HANDLE_MAX, HANDLE_RE } from "@/lib/limits";

type Profile = { handle: string; bio: string };
type Status = "ok" | "taken" | "invalid" | "checking" | "same" | "empty";

const field =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:focus:border-neutral-400";

export function ProfileForm(p: {
  displayName: string; // from Keycloak: shown, never editable
  initial: Profile;
  submitLabel: string;
  onSaved: (handle: string) => void;
  onCancel?: () => void;
}) {
  const [handle, setHandle] = useState(p.initial.handle);
  const [bio, setBio] = useState(p.initial.bio);
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
      <div className="flex items-center gap-3 text-sm">
        <button
          disabled={blocked}
          className="rounded-full bg-foreground px-5 py-2 font-medium text-background transition-opacity enabled:hover:opacity-85 disabled:opacity-40"
        >
          {p.submitLabel}
        </button>
        {p.onCancel && (
          <button
            type="button"
            onClick={p.onCancel}
            className="text-muted hover:text-foreground hover:underline"
          >
            {he.composer.cancel}
          </button>
        )}
        {state.error && (
          <span role="alert" className="text-danger">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
