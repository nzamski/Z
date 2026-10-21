"use client";
// Light / dark / system theme (lib/theme.ts): the picker inside the account menu, and a standalone
// header menu for screens without one (welcome, suspended).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { he } from "@/lib/i18n/he";
import { readTheme, setTheme, subscribeTheme, THEMES, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, React.ReactNode> = {
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
};

const Icon = ({ theme }: { theme: Theme }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICONS[theme]}
  </svg>
);

// localStorage exists only in the browser: the server (and hydration) render "system".
const useTheme = () => useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);

/** Header dropdown state: Esc or a click outside `root` closes it. */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return { open, setOpen, root };
}

// A dropdown's box, and where it opens: under its button, at the end (the default), or above it
// (the rail's account menu, at the bottom of the screen).
export const menuBox =
  "z-20 overflow-hidden rounded-xl border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800";
export const menuClass = `absolute end-0 top-full mt-1 ${menuBox}`;
export const menuUpClass = `absolute start-0 bottom-full mb-1 ${menuBox}`;

/** Three-way segmented control; lives inside a role="menu". */
export function ThemePicker() {
  const theme = useTheme();
  return (
    <div
      role="group"
      aria-label={he.theme.label}
      className="flex gap-0.5 rounded-lg bg-neutral-500/10 p-0.5"
    >
      {THEMES.map((t) => (
        <button
          key={t}
          role="menuitemradio"
          aria-checked={t === theme}
          aria-label={he.theme[t]}
          data-tip={he.theme[t]}
          data-tip-up
          onClick={() => setTheme(t)}
          className="grid flex-1 place-items-center rounded-md py-1.5 text-muted transition-colors hover:text-foreground aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm"
        >
          <Icon theme={t} />
        </button>
      ))}
    </div>
  );
}

/** The theme button with its menu; `up` opens it above the button (the rail, at the screen's bottom). */
// The theme actually shown (a "system" choice resolved by the inline script in the layout).
const shownTheme = () =>
  document.documentElement.dataset.theme === "dark" ? ("dark" as const) : ("light" as const);

/** One click switches between light and dark (the account menu keeps the three-way picker). */
export function ThemeToggle() {
  const shown = useSyncExternalStore(subscribeTheme, shownTheme, () => "light" as const);
  const next = shown === "dark" ? "light" : "dark";
  const label = next === "dark" ? he.theme.toDark : he.theme.toLight;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
    >
      <Icon theme={shown} />
    </button>
  );
}
