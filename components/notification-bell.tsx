"use client";
// Header bell with the unread count (docs/notifications.md). Polls like the new-posts pill, and
// when something new arrives while Z is in a background tab, shows a desktop notification.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { desktopEnabled } from "@/lib/desktop-notifications";
import { RANKING } from "@/lib/feed";
import { he } from "@/lib/i18n/he";
import { notificationHref, notificationText, notificationSnippet } from "@/lib/notification-text";
import { groupNotifications } from "@/lib/notifications";
import type { NotificationRow } from "@/lib/services";

export const READ_EVENT = "z:notifications-read";

async function showDesktop(previous: number) {
  const r = await fetch("/api/notifications?latest=1");
  if (!r.ok) return;
  const { count, latest } = (await r.json()) as { count: number; latest: NotificationRow[] };
  const items = groupNotifications(latest.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })));
  if (!items.length) return;
  const fresh = count - previous;
  const n = new Notification(
    fresh > 1 ? he.notifications.newCount(fresh) : notificationText(items[0]),
    {
      body: fresh > 1 ? notificationText(items[0]) : (notificationSnippet(items[0]) ?? ""),
      icon: "/icon.svg",
      tag: "z-notifications", // one at a time: a newer one replaces it
      lang: "he",
      dir: "rtl",
    },
  );
  n.onclick = () => {
    window.focus();
    location.assign(fresh > 1 ? "/notifications" : notificationHref(items[0]));
    n.close();
  };
}

export function NotificationBell({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  const last = useRef(initial);
  const pathname = usePathname();
  useEffect(() => {
    const check = async () => {
      const r = await fetch("/api/notifications").catch(() => null);
      if (!r?.ok) return;
      const { count } = (await r.json()) as { count: number };
      if (count > last.current && document.hidden && desktopEnabled())
        showDesktop(last.current).catch(() => {});
      last.current = count;
      setCount(count);
    };
    const read = () => {
      last.current = 0;
      setCount(0);
    };
    const visible = () => !document.hidden && check();
    const id = setInterval(check, RANKING.newPostsPollSeconds * 1000);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener(READ_EVENT, read);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener(READ_EVENT, read);
    };
  }, []);
  const shown = pathname === "/notifications" ? 0 : count;
  return (
    <Link
      href="/notifications"
      aria-label={he.notifications.bell(shown)}
      title={he.notifications.title}
      className="relative grid size-9 place-items-center rounded-full transition-colors hover:bg-neutral-500/15"
    >
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
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {shown > 0 && (
        <span className="absolute -top-0.5 -end-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white tabular-nums">
          {shown > 99 ? "99+" : shown}
        </span>
      )}
    </Link>
  );
}
