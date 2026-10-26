"use client";
// X-style profile card shown when hovering (or keyboard-focusing) a user's name.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getUserCardAction, type UserCard } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/buttons";
import { ProfessionBadge } from "@/components/profession-badge";
import { he } from "@/lib/i18n/he";

const OPEN_DELAY = 400;
const CLOSE_DELAY = 200;

export function UserHoverCard({
  handle,
  children,
  className = "",
}: {
  handle: string;
  children: React.ReactNode;
  className?: string; // e.g. self-start for an avatar in a flex row
}) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Still hovered/focused? The card data arrives asynchronously; if the pointer left meanwhile,
  // the late response must not open the card (it used to, and then stayed open).
  const wanted = useRef(false);

  const show = () => {
    wanted.current = true;
    clearTimeout(timer.current);
    if (open) return; // already showing: just cancel a pending close
    timer.current = setTimeout(async () => {
      // Fetched fresh on every open, so follow state changed elsewhere is never stale.
      const c = await getUserCardAction(handle);
      if (c && wanted.current) {
        setCard(c);
        setOpen(true);
      }
    }, OPEN_DELAY);
  };
  // Next keeps visited pages alive (Activity) and restores their state on back: close the card
  // when this page is hidden, or it reappears open with no pointer over it.
  useEffect(
    () => () => {
      wanted.current = false;
      clearTimeout(timer.current);
      setOpen(false);
    },
    [],
  );

  const hide = () => {
    wanted.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  const href = `/u/${encodeURIComponent(handle)}`;

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      // Keyboard focus only: a mouse click also focuses the link, and that focus would keep the
      // card open after the pointer has left.
      onFocus={(e) => (e.target as Element).matches(":focus-visible") && show()}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children}
      {open && card && (
        <div
          role="dialog"
          // Following a link out of the card (profile, followers) closes it.
          onClickCapture={(e) => (e.target as Element).closest("a") && setOpen(false)}
          aria-label={card.displayName}
          className="absolute start-0 top-full z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-background p-4 text-start text-sm font-normal shadow-lg dark:border-neutral-800 dark:shadow-black/60"
        >
          <div className="flex items-start justify-between gap-3">
            <Link href={href} tabIndex={-1} aria-hidden className="hover:opacity-80">
              <Avatar seed={card.avatarSeed} />
            </Link>
            {!card.isSelf && (
              <FollowButton
                key={String(card.viewerFollows)}
                userId={card.id}
                following={card.viewerFollows}
                onChange={(f) =>
                  setCard(
                    (c) => c && { ...c, viewerFollows: f, followers: c.followers + (f ? 1 : -1) },
                  )
                }
              />
            )}
          </div>
          <div className="mt-2 flex min-w-0 items-baseline gap-x-2">
            <Link href={href} className="truncate text-base font-bold hover:underline">
              {card.displayName}
            </Link>
            <span className="shrink-[3] truncate text-muted" dir="ltr">
              @{card.handle}
            </span>
            {card.profession && (
              <span className="self-center">
                <ProfessionBadge profession={card.profession} />
              </span>
            )}
          </div>
          {card.bio && <p className="mt-2 text-neutral-600 dark:text-neutral-400">{card.bio}</p>}
          <div className="mt-3 flex gap-4 text-muted">
            <Link href={`${href}/following`} className="hover:underline">
              <b className="text-foreground">{card.following}</b> {he.profile.following}
            </Link>
            <Link href={`${href}/followers`} className="hover:underline">
              <b className="text-foreground">{card.followers}</b> {he.profile.followers}
            </Link>
          </div>
        </div>
      )}
    </span>
  );
}
