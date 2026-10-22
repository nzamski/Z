"use client";
// One navigation rail item: icon, and its label on wide screens. The current page is bold (aria-current).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { railItem } from "@/components/rail-styles";

export function RailLink(p: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean; // only this path (home), not everything under it
  badge?: { count: number; label: string }; // e.g. open reports on the admin link
}) {
  const pathname = usePathname();
  const current = p.exact ? pathname === p.href : pathname.startsWith(p.href);
  return (
    <Link
      href={p.href}
      aria-current={current ? "page" : undefined}
      aria-label={p.badge?.count ? `${p.label}: ${p.badge.label}` : p.label}
      className={railItem}
    >
      <span className="relative">
        {p.icon}
        {!!p.badge?.count && (
          <span
            aria-hidden
            className="absolute -top-2 -end-2 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums"
          >
            {p.badge.count > 99 ? "99+" : p.badge.count}
          </span>
        )}
      </span>
      <span className="hidden xl:inline">{p.label}</span>
    </Link>
  );
}
