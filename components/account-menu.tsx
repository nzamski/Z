"use client";
// Header account menu behind a round initial: profile, moderation (admins), theme.
import Link from "next/link";
import { initial } from "@/components/avatar";
import { menuClass, ThemePicker, useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";

const itemClass =
  "flex w-full items-center gap-2 px-3 py-2 text-start transition-colors hover:bg-neutral-500/10";
const iconProps = {
  viewBox: "0 0 24 24",
  "aria-hidden": true,
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function AccountMenu(p: { handle: string; displayName: string; admin: boolean }) {
  const { open, setOpen, root } = useMenu();
  const close = () => setOpen(false);
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={he.account.menu}
        data-tip={he.account.menu}
        className="grid size-9 place-items-center rounded-full bg-neutral-500/15 text-base font-bold transition-colors hover:bg-neutral-500/25 aria-expanded:bg-neutral-500/25"
      >
        <span aria-hidden>{initial(p.displayName, p.handle)}</span>
      </button>
      {open && (
        <div role="menu" aria-label={he.account.menu} className={`${menuClass} w-56`}>
          <div className="flex min-w-0 items-baseline gap-x-2 px-3 py-2">
            <span className="truncate font-bold">{p.displayName}</span>
            <span className="shrink-[3] truncate text-muted" dir="ltr">
              @{p.handle}
            </span>
          </div>
          <hr className="border-neutral-200 dark:border-neutral-800" />
          <Link
            role="menuitem"
            href={`/u/${encodeURIComponent(p.handle)}`}
            onClick={close}
            className={itemClass}
          >
            <svg {...iconProps}>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
            {he.account.profile}
          </Link>
          {p.admin && (
            <Link role="menuitem" href="/admin" onClick={close} className={itemClass}>
              {/* Shield: moderation */}
              <svg {...iconProps}>
                <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" />
              </svg>
              {he.moderation.nav}
            </Link>
          )}
          <hr className="border-neutral-200 dark:border-neutral-800" />
          <div className="px-3 py-2">
            <div className="mb-1.5 text-xs text-muted">{he.theme.label}</div>
            <ThemePicker />
          </div>
        </div>
      )}
    </div>
  );
}
