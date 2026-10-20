import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ListSkeleton } from "@/components/loading";
import { DesktopToggle, MarkRead } from "@/components/notifications-client";
import { requireViewer } from "@/lib/auth/viewer";
import { ago, snippet } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { notificationHref, notificationSnippet, notificationText } from "@/lib/notification-text";
import { groupNotifications, type NotificationItem } from "@/lib/notifications";
import { notificationsPage } from "@/lib/services";
import type { Metadata } from "next";

const T = he.notifications;

// One icon per kind: heart (likes), bubble (comments), person (follows), @ (mentions), shield.
function KindIcon({ type }: { type: NotificationItem["type"] }) {
  const like = type === "like_post" || type === "like_comment" || type === "author_liked";
  const path = like
    ? "M12 20.5s-7.5-4.6-9.4-9.3C1.3 7.9 3.4 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.4 0 5.5 3.4 4.2 6.7-1.9 4.7-9.4 9.3-9.4 9.3Z"
    : type === "follow"
      ? "M15 19c0-2.8-2.7-5-6-5s-6 2.2-6 5M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M22 11h-6"
      : type.startsWith("mention")
        ? "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"
        : type.startsWith("removed") || type.startsWith("restored")
          ? "M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z"
          : "M12 4c4.97 0 9 3.36 9 7.5S16.97 19 12 19c-1 0-1.96-.13-2.86-.38L4.5 20.5l1.2-3.6C4.03 15.55 3 13.62 3 11.5 3 7.36 7.03 4 12 4Z";
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`mt-0.5 size-5 shrink-0 ${like ? "text-like" : "text-link"}`}
      fill={like ? "currentColor" : "none"}
      stroke={like ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

async function Notifications({ searchParams }: PageProps<"/notifications">) {
  await connection();
  const viewer = await requireViewer();
  const before = z.uuid().safeParse((await searchParams).before);
  const page = await notificationsPage(viewer.id, before.data);
  const items = groupNotifications(page.items);
  const newest = page.items[0];
  return (
    <>
      <h1 className="border-b border-neutral-200 px-4 py-3 text-start text-lg font-bold dark:border-neutral-800">
        {T.title}
      </h1>
      <DesktopToggle />
      {newest?.unread && <MarkRead upTo={newest.id} />}
      {items.length ? (
        <ul>
          {items.map((n) => {
            const text = notificationSnippet(n);
            return (
              <li key={n.id}>
                <Link
                  href={notificationHref(n)}
                  className={`flex gap-3 border-b border-neutral-200 px-4 py-3 text-start transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03] ${
                    n.unread ? "bg-sky-500/5" : ""
                  }`}
                >
                  <KindIcon type={n.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block">
                      <span className={n.unread ? "font-bold" : ""}>{notificationText(n)}</span>
                      <span className="text-sm text-muted" suppressHydrationWarning>
                        {" · "}
                        {ago(n.createdAt)}
                      </span>
                    </span>
                    {text && (
                      <span className="mt-0.5 line-clamp-2 block text-sm text-muted">
                        {snippet(text, 140)}
                      </span>
                    )}
                    {n.reason && <span className="mt-0.5 block text-sm">{T.reason(n.reason)}</span>}
                  </span>
                  {n.unread && (
                    <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-sky-600" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-4 text-start text-muted">{T.empty}</p>
      )}
      {page.next && (
        <div className="p-4 text-center text-sm">
          <Link href={`?before=${page.next}`} className="text-link hover:underline">
            {he.feed.loadMore}
          </Link>
        </div>
      )}
    </>
  );
}

export const metadata: Metadata = { title: he.titles.notifications };

export default function Page(props: PageProps<"/notifications">) {
  return (
    <main>
      <Suspense fallback={<ListSkeleton />}>
        <Notifications {...props} />
      </Suspense>
    </main>
  );
}
