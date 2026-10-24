import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/buttons";
import { ClickableCard } from "@/components/clickable-card";
import { PlainText } from "@/components/post-card";
import { ProfessionBadge } from "@/components/profession-badge";
import { RoleLine } from "@/components/role-line";
import { UserHoverCard } from "@/components/user-hover-card";
import type { RoleLine as Role } from "@/lib/services";

/** A person in a list (search, followers, following, likers, welcome suggestions): avatar, name,
 * badge, role (when the list has one) and bio, with a follow button. The row opens the profile; the avatar, name and handle show
 * the hover card. */
export function UserRow(p: {
  user: {
    id: string;
    handle: string;
    displayName: string;
    bio: string;
    profession?: string | null;
    avatarSeed: string;
    role?: Role | null;
  };
  viewerFollows: boolean;
  isSelf: boolean;
}) {
  const href = `/u/${encodeURIComponent(p.user.handle)}`;
  return (
    <ClickableCard
      href={href}
      srLink={false}
      className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5 text-start dark:border-neutral-800"
    >
      <Avatar seed={p.user.avatarSeed} handle={p.user.handle} />
      <div className="min-w-0 flex-1">
        {/* Name and handle on one line (like the post byline); the handle truncates first. No
            overflow-hidden on the hover card's wrapper: it would clip the card. */}
        <span className="flex min-w-0 items-baseline gap-x-2">
          <UserHoverCard handle={p.user.handle} className="min-w-0">
            <span className="flex min-w-0 items-baseline gap-x-2">
              <Link href={href} className="truncate font-bold hover:underline">
                {p.user.displayName}
              </Link>
              <span className="shrink-[3] truncate text-sm text-muted" dir="ltr">
                @{p.user.handle}
              </span>
            </span>
          </UserHoverCard>
          {p.user.profession && (
            <span className="self-center">
              <ProfessionBadge profession={p.user.profession} />
            </span>
          )}
        </span>
        <RoleLine role={p.user.role} className="mt-0.5" />
        {p.user.bio && <PlainText text={p.user.bio} className="mt-0.5 text-sm" />}
      </div>
      {!p.isSelf && <FollowButton userId={p.user.id} following={p.viewerFollows} />}
    </ClickableCard>
  );
}
