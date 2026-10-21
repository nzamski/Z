// The start-side navigation rail on wide screens (the header keeps these on phones): home,
// search, notifications, topics, profile, admin, a new-post button, and the account menu.
import { AccountMenu } from "@/components/account-menu";
import { NewPostButton } from "@/components/new-post-button";
import { NotificationBell } from "@/components/notification-bell";
import { RailLink } from "@/components/rail-link";
import { railItem } from "@/components/rail-styles";
import { getSession } from "@/lib/auth/session";
import { he } from "@/lib/i18n/he";
import { getUser, isAdmin, unreadNotifications } from "@/lib/services";

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
      <RailLink
        href={`/u/${encodeURIComponent(user.handle)}`}
        label={he.account.profile}
        icon={<Icon d={ICONS.profile} />}
      />
      {admin && (
        <RailLink href="/admin" label={he.moderation.nav} icon={<Icon d={ICONS.admin} />} />
      )}
      <NewPostButton
        viewer={{ displayName: user.displayName, handle: user.handle }}
        icon={<Icon d={ICONS.pen} />}
      />
      <div className="mt-auto flex justify-center pb-2 xl:justify-start xl:px-2">
        <AccountMenu handle={user.handle} displayName={user.displayName} admin={admin} up />
      </div>
    </nav>
  );
}
