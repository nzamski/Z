"use client";
// Infinite scroll (PLAN.md §6.1): an IntersectionObserver on a sentinel fetches /api/feed pages and
// dedupes them by id. The "load more" link is a plain server-rendered page when JS is off.
// List + scroll position are saved per view in sessionStorage and restored on return.
// For You / Following poll for newer posts by others and offer a "show new posts" pill.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { mergeById, RANKING, type FeedView } from "@/lib/feed";
import { he } from "@/lib/i18n/he";
import type { FeedPage, PostSummary } from "@/lib/services";

type Snapshot = {
  items: PostSummary[];
  next: string | null;
  asOf: string;
  scrollY: number;
  savedAt: number;
};

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
  view: FeedView;
  author?: string; // profile: that user's posts
  q?: string; // search results
  emptyText?: string;
  viewerId: string;
  first: PostSummary[];
  next: string | null;
  asOf: string;
}) {
  const query = useMemo(
    () => ({ view: p.view, ...(p.author ? { author: p.author } : {}), ...(p.q ? { q: p.q } : {}) }),
    [p.view, p.author, p.q],
  );
  const key = `z-feed:${new URLSearchParams(query)}`;
  const announce = !p.author && !p.q && p.view !== "latest";
  const [items, setItems] = useState(p.first);
  const [next, setNext] = useState(p.next);
  const [asOf, setAsOf] = useState(p.asOf);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const restored = useRef(false);
  const restoreY = useRef<number | null>(null);
  const scrollY = useRef(0);

  // refresh() after any action re-renders the server's first page. Only the viewer's own posts
  // published since the snapshot go on top (re-ranking can surface older ones; ignore those); others' are announced by the pill, and the list never re-sorts under the reader.
  const [first, setFirst] = useState(p.first);
  if (first !== p.first) {
    setFirst(p.first);
    setItems((prev) => {
      const have = new Set(prev.map((x) => x.id));
      const mine = p.first.filter(
        (x) => x.authorId === p.viewerId && x.createdAt > new Date(asOf) && !have.has(x.id),
      );
      return [...mine, ...prev];
    });
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
    setAsOf(snap.asOf);
    restoreY.current = snap.scrollY;
  }, [key]);

  useLayoutEffect(() => {
    if (restoreY.current === null) return;
    window.scrollTo(0, restoreY.current);
    restoreY.current = null;
  }, [items]);

  // Shown again from Next's Activity cache (back within the last 3 routes): the DOM is intact,
  // but the window scroll isn't reliably where we left it.
  const shown = useRef(false);
  useLayoutEffect(() => {
    if (shown.current) window.scrollTo(0, scrollY.current);
    shown.current = true;
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const save = () =>
      writeSnapshot(key, { items, next, asOf, scrollY: scrollY.current, savedAt: Date.now() });
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
  }, [key, items, next, asOf]);

  const load = useCallback(async () => {
    if (busy.current || !next) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await fetch(`/api/feed?${new URLSearchParams({ ...query, cursor: next })}`);
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
  }, [next, query]);

  // Polls only while this route is visible: Activity cleans effects up when it hides the page.
  useEffect(() => {
    if (!announce) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(
          `/api/feed/new?${new URLSearchParams({ view: p.view, since: asOf })}`,
        );
        if (r.ok) setNewCount(((await r.json()) as { count: number }).count);
      } catch {} // offline for a moment: try again next tick
    };
    const t = setInterval(check, RANKING.newPostsPollSeconds * 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [announce, p.view, asOf]);

  // The pill puts the new posts on top (For You might rank them lower), then a fresh snapshot.
  const showNew = async () => {
    try {
      const [fresh, r] = await Promise.all([
        fetch(`/api/feed/new?${new URLSearchParams({ view: p.view, since: asOf, list: "1" })}`),
        fetch(`/api/feed?${new URLSearchParams(query)}`),
      ]);
      if (!fresh.ok || !r.ok) return;
      const page = (await r.json()) as FeedPage;
      const { items: added } = (await fresh.json()) as { items: PostSummary[] };
      setItems(mergeById(added, page.items).map(revive));
      setNext(page.next);
      setAsOf(page.asOf);
      setFailed(false);
      setNewCount(0);
      window.scrollTo(0, 0);
    } catch {}
  };

  const pill = newCount > 0 && (
    <div className="sticky top-[calc(var(--header-h)+var(--tabs-h)+0.75rem)] z-10 flex h-0 justify-center">
      <button
        onClick={showNew}
        className="h-9 rounded-full bg-link px-4 text-sm font-medium text-background shadow-md transition-opacity hover:opacity-90"
      >
        {he.feed.showNew(newCount)}
      </button>
    </div>
  );

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || failed) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(), {
      rootMargin: "800px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [next, failed, load]);

  if (!items.length) {
    return (
      <>
        {pill}
        <p className="p-4 text-start text-muted">{p.emptyText ?? he.feed.empty}</p>
      </>
    );
  }
  return (
    <>
      {pill}
      <ul ref={list}>
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </ul>
      <div ref={sentinel} className="p-4 text-center text-sm text-muted">
        {loading ? (
          he.feed.loading
        ) : next ? (
          <a
            // No-JS: a plain page; home reads the view from its cookie, search keeps `q`.
            href={`?${new URLSearchParams({ ...(p.q ? { q: p.q } : {}), cursor: next })}`}
            onClick={(e) => {
              e.preventDefault();
              setFailed(false);
              load();
            }}
            className="text-link hover:underline"
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
