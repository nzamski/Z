// A person's avatar: their generated pattern (lib/avatar.ts) in a circle (Z has no profile
// pictures). Links to the profile and shows the same hover card as the name beside it; keyboards
// and screen readers use that name link.
import Link from "next/link";
import { UserHoverCard } from "@/components/user-hover-card";
import { avatarPattern } from "@/lib/avatar";

export function AvatarImage(p: { seed: string; className: string }) {
  const { hue, cells } = avatarPattern(p.seed);
  return (
    // viewBox -1.5..6.5: the 5×5 pattern fits inside the circle without its corners clipped.
    <svg
      aria-hidden
      viewBox="-1.5 -1.5 8 8"
      className={`shrink-0 rounded-full ${p.className}`}
      style={{ background: `hsl(${hue} 60% 50% / 0.18)` }}
    >
      {cells.map(([x, y]) => (
        <rect
          key={`${x},${y}`}
          x={x}
          y={y}
          width="1.02"
          height="1.02"
          fill={`hsl(${hue} 60% 48%)`}
        />
      ))}
    </svg>
  );
}

export function Avatar(p: {
  seed: string;
  handle?: string | null;
  small?: boolean;
  large?: boolean; // the profile page's
  noCard?: boolean; // no hover card (your own avatar beside the composer)
}) {
  const circle = (
    <AvatarImage seed={p.seed} className={p.small ? "size-8" : p.large ? "size-20" : "size-10"} />
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
