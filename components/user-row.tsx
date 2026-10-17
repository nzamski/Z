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
    <li className="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 text-start transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-white/[0.03]">
      <Link href={href} className="min-w-0 flex-1">
        <span className="block truncate font-bold hover:underline">{p.user.displayName}</span>
        <span className="block text-sm text-muted">
          <span dir="ltr">@{p.user.handle}</span>
        </span>
        {p.user.bio && <PlainText text={p.user.bio} className="mt-1 text-sm" />}
      </Link>
      {!p.isSelf && <FollowButton userId={p.user.id} following={p.viewerFollows} />}
    </li>
  );
}
