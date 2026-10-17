// Loading states: skeletons shaped like what's coming (posts, people), and a small spinner for
// inline waits. Screen readers hear "טוען…"; animation stops under prefers-reduced-motion.
import { he } from "@/lib/i18n/he";

const bar = "rounded-full bg-neutral-200 dark:bg-neutral-800";

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{he.feed.loading}</span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

function PostSkeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-3 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <div className="flex gap-2">
        <div className={`${bar} h-3.5 w-24`} />
        <div className={`${bar} h-3.5 w-16 opacity-60`} />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`${bar} h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
      <div className="flex gap-8 pt-1">
        <div className={`${bar} size-4`} />
        <div className={`${bar} size-4`} />
      </div>
    </div>
  );
}

/** Default page fallback: a few post-shaped placeholders. */
export function Loading() {
  return (
    <Status>
      {[2, 3, 1, 2].map((lines, i) => (
        <PostSkeleton key={i} lines={lines} />
      ))}
    </Status>
  );
}

/** Fallback for lists of people (followers / following). */
export function ListSkeleton() {
  return (
    <Status>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-neutral-200 px-4 py-4 dark:border-neutral-800"
        >
          <div className="space-y-2">
            <div className={`${bar} h-3.5 w-28`} />
            <div className={`${bar} h-3 w-20 opacity-60`} />
          </div>
          <div className={`${bar} h-8 w-20`} />
        </div>
      ))}
    </Status>
  );
}

/** Inline spinner (next feed page, "show more"). */
export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <span role="status" className="inline-flex">
      <span className="sr-only">{he.feed.loading}</span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className={`${className} animate-spin text-link motion-reduce:animate-none`}
        fill="none"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2.5} opacity={0.2} />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
