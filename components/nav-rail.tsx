// The start-side navigation rail on wide screens (the header keeps these on phones): home,
// search, notifications, topics, saved, profile, admin, a new-post button, and the account menu.
import { Avatar } from "@/components/avatar";
import { NewPostButton } from "@/components/new-post-button";
import { NotificationBell } from "@/components/notification-bell";
import { RailLink } from "@/components/rail-link";
import { ThemeToggle } from "@/components/theme-menu";
import { railItem } from "@/components/rail-styles";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser, isAdmin, unreadNotifications, openReportCount } from "@/lib/services";

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="size-6 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5",
  topics: "M5 9h14M5 15h14M10 3 8 21M16 3l-2 18",
  saved: "M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  admin: "M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z",
  pen: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
};

export async function NavRail() {
  const session = await getSession();
  const user = session && (await getUser(session.uid));
  // Same rule as the header: nothing to navigate to before the welcome, or while suspended.
  if (!user?.handle || !user.onboardedAt || user.suspendedAt) return null;
  const [admin, unread] = await Promise.all([isAdmin(user.id), unreadNotifications(user.id)]);
  const reports = admin ? await openReportCount() : 0;
  return (
    <nav aria-label={he.nav.main} className="flex h-full flex-col gap-1 p-2 xl:p-3">
      <RailLink href="/" exact label={he.nav.homePage} icon={<Icon d={ICONS.home} />} />
      <RailLink href="/search" label={he.nav.search} icon={<Icon d={ICONS.search} />} />
      <NotificationBell
        initial={unread}
        className={`relative ${railItem}`}
        label={<span className="hidden xl:inline">{he.notifications.title}</span>}
      />
      <RailLink href="/topics" label={he.topics.title} icon={<Icon d={ICONS.topics} />} />
      <RailLink href="/saved" label={he.bookmarks.title} icon={<Icon d={ICONS.saved} />} />
      <RailLink
        href={`/u/${encodeURIComponent(user.handle)}`}
        label={he.account.profile}
        icon={<Icon d={ICONS.profile} />}
      />
      {admin && (
        <RailLink
          href="/admin"
          label={he.moderation.nav}
          icon={<Icon d={ICONS.admin} />}
          badge={{ count: reports, label: he.reports.badge(reports) }}
        />
      )}
      <NewPostButton
        viewer={{ displayName: user.displayName, handle: user.handle }}
        icon={<Icon d={ICONS.pen} />}
      />
      {/* Bottom: who you are (as on X; not a button: the rail has the links), and the theme at
          the row's other end. Icon-only rail (lg): the theme under the avatar. */}
      <div className="mt-auto flex flex-col items-center gap-2 p-2 xl:flex-row xl:gap-3">
        <Avatar name={user.displayName} />
        <div className="hidden min-w-0 xl:block">
          <div className="truncate font-bold">{user.displayName}</div>
          <div className="truncate text-sm text-muted" dir="ltr">
            @{user.handle}
          </div>
        </div>
        <div className="xl:ms-auto">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
