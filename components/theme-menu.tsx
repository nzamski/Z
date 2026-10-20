"use client";
// Header menu: light / dark / system theme (lib/theme.ts). Esc or a click outside closes it.
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

export function ThemeMenu() {
  const [open, setOpen] = useState(false);
  // localStorage exists only in the browser: the server (and hydration) render "system".
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);
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
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${he.theme.label}: ${he.theme[theme]}`}
        title={he.theme.label}
        className="grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
      >
        <Icon theme={theme} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={he.theme.label}
          className="absolute end-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800"
        >
          {THEMES.map((t) => (
            <button
              key={t}
              role="menuitemradio"
              aria-checked={t === theme}
              onClick={() => {
                setTheme(t);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-neutral-500/10 aria-checked:font-bold"
            >
              <Icon theme={t} />
              {he.theme[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
