import Link from "next/link";
import { FollowButton } from "@/components/buttons";
import { PlainText } from "@/components/post-card";

/** A person in a list (followers, following, welcome suggestions), with a follow button. */
export function UserRow(p: {
  user: { id: string; handle: string; displayName: string; bio: string };
  viewerFollows: boolean;
  isSelf: boolean;
}) {
  const href = `/u/${encodeURIComponent(p.user.handle)}`;
  return (
    <li className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5 text-start transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]">
      <Link href={href} className="min-w-0 flex-1">
        {/* Name and handle on one line (like the post byline); the handle truncates first. */}
        <span className="flex min-w-0 items-baseline gap-x-2">
          <span className="truncate font-bold hover:underline">{p.user.displayName}</span>
          <span className="shrink-[3] truncate text-sm text-muted" dir="ltr">
            @{p.user.handle}
          </span>
        </span>
        {p.user.bio && <PlainText text={p.user.bio} className="mt-0.5 text-sm" />}
      </Link>
      {!p.isSelf && <FollowButton userId={p.user.id} following={p.viewerFollows} />}
    </li>
  );
}
