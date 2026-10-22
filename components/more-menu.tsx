"use client";
// The "⋯" button and its dropdown, shared by posts (post-menu.tsx), comments and the user page's
// moderation. Items are plain buttons/links with `menuItem` (or `menuDanger`) and a `MenuIcon`.
// Confirming popups (DeleteButton, ModerateButton) render inside the menu, so clicks in them don't
// count as "outside" and close it.
import { useMenu } from "@/components/theme-menu";
import { menuClass } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";

// One text color each: two in one class list and the stylesheet's order would pick.
const itemBase =
  "flex w-full items-center gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-neutral-500/10";
export const menuItem = `${itemBase} text-foreground`;
export const menuDanger = `${itemBase} text-danger`;

export function MenuIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export const MENU_ICON = {
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  pin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z",
  unpin: "M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6ZM3 3l18 18",
  follow: "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a7 7 0 0 1 14 0M19 8v6M16 11h6",
  unfollow: "M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM3 21a7 7 0 0 1 14 0M16 11h6",
  delete: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  remove: "M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3ZM9 9l6 6M15 9l-6 6",
  // A circle with a slash: locked out
  suspend: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
  // A circle with a check: let back in
  unsuspend: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12l3 3 5-6",
  // Text lines with an eraser stroke
  clearBio: "M4 6h16M4 11h10M4 16h6M14 20l6-6M20 20l-6-6",
  // @ with a circular arrow
  resetHandle: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a8 8 0 1 0-3.2 6.4",
  // A flag on a pole
  report: "M5 21V4M5 4h11l-2 4 2 4H5",
};

export function MoreMenu(p: {
  menu: ReturnType<typeof useMenu>;
  onOpen?: () => void; // e.g. read the clock for "can I still edit"
  busy?: boolean;
  className?: string; // the button's offsets in its row
  children: React.ReactNode;
}) {
  const { open, setOpen, root } = p.menu;
  return (
    <div ref={root} className={`relative ${p.className ?? ""}`}>
      <button
        type="button"
        onClick={() => {
          if (!open) p.onOpen?.();
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={he.post.more}
        data-tip={he.post.more}
        className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-sky-500/10 hover:text-sky-500 aria-expanded:bg-sky-500/10 aria-expanded:text-sky-500"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-[18px]" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={he.post.more}
          aria-busy={p.busy}
          className={`${menuClass} w-60`}
        >
          {p.children}
        </div>
      )}
    </div>
  );
}
