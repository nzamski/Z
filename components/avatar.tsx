// A person's avatar: the first letter of their name in a circle (Z has no profile pictures).
// Links to the profile for the mouse; keyboards and screen readers use the name link beside it.
import Link from "next/link";

export const initial = (name: string, handle?: string | null) =>
  ([...name.trim()][0] ?? handle?.[0] ?? "?").toUpperCase();

export function Avatar(p: { name: string; handle?: string | null; small?: boolean }) {
  const circle = (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-neutral-500/15 font-bold text-foreground ${p.small ? "size-8 text-sm" : "size-10 text-base"}`}
    >
      {initial(p.name, p.handle)}
    </span>
  );
  if (!p.handle) return circle;
  return (
    <Link
      href={`/u/${encodeURIComponent(p.handle)}`}
      tabIndex={-1}
      aria-hidden
      className="shrink-0 self-start transition-opacity hover:opacity-80"
    >
      {circle}
    </Link>
  );
}
