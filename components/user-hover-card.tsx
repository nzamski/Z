"use client";
// X-style profile card shown when hovering (or keyboard-focusing) a user's name.
import Link from "next/link";
import { useRef, useState } from "react";
import { getUserCardAction, type UserCard } from "@/app/actions";
import { FollowButton } from "@/components/buttons";
import { he } from "@/lib/i18n/he";

const OPEN_DELAY = 400;
const CLOSE_DELAY = 200;
const cache = new Map<string, Promise<UserCard | null>>();

export function UserHoverCard({ handle, children }: { handle: string; children: React.ReactNode }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!cache.has(handle)) cache.set(handle, getUserCardAction(handle));
      const c = await cache.get(handle)!;
      if (c) {
        setCard(c);
        setOpen(true);
      }
    }, OPEN_DELAY);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };
  const href = `/u/${encodeURIComponent(handle)}`;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
    >
      {children}
      {open && card && (
        <div
          role="dialog"
          aria-label={card.displayName}
          className="absolute start-0 top-full z-30 mt-2 w-72 rounded-xl border border-neutral-200 bg-background p-4 text-start text-sm font-normal shadow-lg dark:border-neutral-800 dark:shadow-black/60"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={href} className="block truncate text-base font-bold hover:underline">
                {card.displayName}
              </Link>
              <span className="text-neutral-500" dir="ltr">
                @{card.handle}
              </span>
            </div>
            {!card.isSelf && (
              <FollowButton
                key={String(card.viewerFollows)}
                userId={card.id}
                following={card.viewerFollows}
                onChange={(f) => {
                  cache.delete(handle);
                  setCard({ ...card, viewerFollows: f, followers: card.followers + (f ? 1 : -1) });
                }}
              />
            )}
          </div>
          {(card.roleTitle || card.unit) && (
            <p className="mt-2">{[card.roleTitle, card.unit].filter(Boolean).join(" · ")}</p>
          )}
          {card.bio && <p className="mt-2 text-neutral-600 dark:text-neutral-400">{card.bio}</p>}
          <div className="mt-3 flex gap-4 text-neutral-500">
            <span>
              <b className="text-foreground">{card.following}</b> {he.profile.following}
            </span>
            <span>
              <b className="text-foreground">{card.followers}</b> {he.profile.followers}
            </span>
          </div>
        </div>
      )}
    </span>
  );
}
