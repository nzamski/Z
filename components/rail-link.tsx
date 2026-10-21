"use client";
// One navigation rail item: icon, and its label on wide screens (a tooltip when only the icon
// shows). The current page is bold (aria-current).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { railItem } from "@/components/rail-styles";

export function RailLink(p: {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean; // only this path (home), not everything under it
}) {
  const pathname = usePathname();
  const current = p.exact ? pathname === p.href : pathname.startsWith(p.href);
  return (
    <Link
      href={p.href}
      aria-current={current ? "page" : undefined}
      aria-label={p.label}
      data-tip={p.label}
      className={railItem}
    >
      {p.icon}
      <span className="hidden xl:inline">{p.label}</span>
    </Link>
  );
}
