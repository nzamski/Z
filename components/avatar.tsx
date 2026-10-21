// A person's avatar: the first letter of their name in a circle (Z has no profile pictures).
// Links to the profile and shows the same hover card as the name beside it; keyboards and screen
// readers use that name link.
import Link from "next/link";
import { UserHoverCard } from "@/components/user-hover-card";

export const initial = (name: string, handle?: string | null) =>
  ([...name.trim()][0] ?? handle?.[0] ?? "?").toUpperCase();

export function Avatar(p: {
  name: string;
  handle?: string | null;
  small?: boolean;
  noCard?: boolean; // no hover card (your own avatar beside the composer)
}) {
  const circle = (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-neutral-500/15 font-bold text-foreground ${p.small ? "size-8 text-sm" : "size-10 text-base"}`}
    >
      {initial(p.name, p.handle)}
    </span>
  );
  if (!p.handle) return circle;
  const link = (
    <Link
      href={`/u/${encodeURIComponent(p.handle)}`}
      tabIndex={-1}
      aria-hidden
      className="block shrink-0 self-start transition-opacity hover:opacity-80"
    >
      {circle}
    </Link>
  );
  if (p.noCard) return link;
  return (
    <UserHoverCard handle={p.handle} className="shrink-0 self-start">
      {link}
    </UserHoverCard>
  );
}
