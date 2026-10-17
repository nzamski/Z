"use client";
// Infinite scroll (PLAN.md §6.1): an IntersectionObserver on a sentinel fetches /api/feed pages and
// dedupes them by id. The "load more" link is a plain server-rendered page when JS is off.
// List + scroll position are saved per view in sessionStorage and restored on return.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { mergeById, RANKING } from "@/lib/feed";
import { he } from "@/lib/i18n/he";
import type { FeedPage, PostSummary } from "@/lib/services";

type Snapshot = { items: PostSummary[]; next: string | null; scrollY: number; savedAt: number };

// JSON turns dates into strings.
const revive = (p: PostSummary): PostSummary => ({
  ...p,
  createdAt: new Date(p.createdAt),
  editedAt: p.editedAt && new Date(p.editedAt),
});

// A reload starts a fresh snapshot (§6.1); later client-side mounts may restore.
let firstMount = true;
function mayRestore() {
  if (!firstMount) return true;
  firstMount = false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
  return nav?.type === "back_forward";
}

function readSnapshot(key: string): Snapshot | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(key) ?? "null") as Snapshot | null;
    if (!s || Date.now() - s.savedAt > RANKING.restoreMaxAgeMinutes * 60_000) return null;
    return { ...s, items: s.items.map(revive) };
  } catch {
    return null;
  }
}

function writeSnapshot(key: string, s: Snapshot) {
  try {
    sessionStorage.setItem(key, JSON.stringify(s));
  } catch {} // full or blocked storage: restoring is best-effort
}

export function FeedList(p: {
  params: Record<string, string>; // view/author: sent to /api/feed and kept in the load-more link
  first: PostSummary[];
  next: string | null;
}) {
  const key = `z-feed:${new URLSearchParams(p.params)}`;
  const [items, setItems] = useState(p.first);
  const [next, setNext] = useState(p.next);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const restored = useRef(false);
  const restoreY = useRef<number | null>(null);
  const scrollY = useRef(0);

  // refresh() after any action re-renders the server's first page. Only posts we don't have yet
  // (e.g. one just published) go on top; the visible list never re-sorts under the reader.
  const [first, setFirst] = useState(p.first);
  if (first !== p.first) {
    setFirst(p.first);
    setItems((prev) => mergeById(prev, p.first).slice(prev.length).concat(prev));
  }

  useEffect(() => {
    if (restored.current) return; // Activity re-runs effects when the route is shown again
    restored.current = true;
    const snap = mayRestore() ? readSnapshot(key) : null;
    if (!snap) return;
    // sessionStorage only exists after hydration, so this has to be an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(snap.items);
    setNext(snap.next);
    restoreY.current = snap.scrollY;
  }, [key]);

  useLayoutEffect(() => {
    if (restoreY.current === null) return;
    window.scrollTo(0, restoreY.current);
    restoreY.current = null;
  }, [items]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () =>
      writeSnapshot(key, { items, next, scrollY: scrollY.current, savedAt: Date.now() });
    const onScroll = () => {
      if (!list.current?.offsetParent) return; // hidden: another route is scrolling the window
      scrollY.current = window.scrollY;
      clearTimeout(t);
      t = setTimeout(save, 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
      save();
    };
  }, [key, items, next]);

  const load = useCallback(async () => {
    if (busy.current || !next) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/feed?${new URLSearchParams({ ...p.params, cursor: next })}`);
      if (!r.ok) throw new Error(String(r.status));
      const page = (await r.json()) as FeedPage;
      setItems((prev) => mergeById(prev, page.items.map(revive)));
      setNext(page.next);
      setFailed(false);
    } catch {
      setFailed(true); // no retry loop: the observer only re-arms when `next` changes
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [next, p.params]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || failed) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [next, failed, load]);

  if (!items.length) return <p className="p-4 text-start text-neutral-500">{he.feed.empty}</p>;
  return (
    <>
      <ul ref={list}>
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ul>
      <div ref={sentinel} className="p-4 text-center text-sm text-neutral-500">
        {loading ? (
          he.feed.loading
        ) : next ? (
          <a
            href={`?${new URLSearchParams({ ...p.params, cursor: next })}`}
            onClick={(e) => {
              e.preventDefault();
              setFailed(false);
              load();
            }}
            className="text-sky-600 hover:underline"
          >
            {failed ? he.feed.retry : he.feed.loadMore}
          </a>
        ) : (
          items.length > RANKING.pageSize && he.feed.end
        )}
      </div>
    </>
  );
}
