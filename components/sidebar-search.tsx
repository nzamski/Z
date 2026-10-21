"use client";
// The sidebar's search box, with suggestions as you type: people and topics (the composer's
// autocomplete actions), and "search for …". ↑/↓ choose, Enter opens; Enter with nothing chosen
// searches. A plain GET form underneath, so it works before hydration too. Empty and focused, it
// lists your recent searches (this browser only: localStorage), X-style. Going anywhere from it
// clears the box.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { mentionSuggestionsAction, topicSuggestionsAction } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { tagHref } from "@/lib/tags";

type Row = { href: string; label: string; detail?: string; ltrDetail?: boolean; query?: boolean };

const RECENT = "z-recent-searches";
const RECENT_MAX = 8;
function readRecent(): Row[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "[]");
  } catch {
    return [];
  }
}
function writeRecent(rows: Row[]) {
  try {
    localStorage.setItem(RECENT, JSON.stringify(rows.slice(0, RECENT_MAX)));
  } catch {} // storage blocked: no recents, search still works
  return rows;
}

export function SidebarSearch() {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<Row[]>([]);

  useEffect(() => {
    const text = q.trim();
    if (!text) return;
    let stale = false;
    const t = setTimeout(async () => {
      const term = text.replace(/^[@#]/, "");
      const [people, topics] = await Promise.all([
        text.startsWith("#") ? [] : mentionSuggestionsAction(term),
        text.startsWith("@") ? [] : topicSuggestionsAction(term),
      ]);
      if (stale) return;
      setRows([
        ...people.map((u) => ({
          href: `/u/${encodeURIComponent(u.handle)}`,
          label: u.displayName,
          detail: `@${u.handle}`,
          ltrDetail: true,
        })),
        ...topics.map((t) => ({
          href: tagHref(t.tag),
          label: `#${t.tag}`,
          detail: he.topics.posts(t.posts),
        })),
        {
          href: `/search?q=${encodeURIComponent(text)}`,
          label: he.search.searchFor(text),
          query: true,
        },
      ]);
      setActive(-1);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // Remembered newest first, once each. "Search for …" is kept as just the words.
  const go = (row: Row) => {
    const keep = row.query ? { href: row.href, label: q.trim(), query: true } : row;
    if (keep.label)
      setRecent(writeRecent([keep, ...readRecent().filter((r) => r.href !== row.href)]));
    setOpen(false);
    setQ("");
    setActive(-1);
    router.push(row.href);
  };
  const forget = (href?: string) =>
    setRecent(writeRecent(href ? recent.filter((r) => r.href !== href) : []));
  const reopen = () => {
    setRecent(readRecent());
    setOpen(true);
  };
  const typing = !!q.trim();
  // Recent rows open as they are; a remembered query is a search for those words.
  const list = typing ? rows : recent;
  const shown = open && list.length > 0;

  return (
    <form
      ref={box}
      action="/search"
      role="search"
      className="relative"
      onSubmit={(e) => {
        const text = q.trim();
        if (active < 0 && !text) return e.preventDefault();
        e.preventDefault();
        go(
          active >= 0
            ? list[active]
            : { href: `/search?q=${encodeURIComponent(text)}`, label: text, query: true },
        );
      }}
    >
      <input
        name="q"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        // Click too: after going somewhere the box keeps its focus, closed.
        onFocus={reopen}
        onClick={reopen}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            // -1 is "nothing chosen" (Enter searches); Up from the first row goes back to it.
            setActive((a) =>
              e.key === "ArrowDown" ? Math.min(a + 1, list.length - 1) : Math.max(a - 1, -1),
            );
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={he.search.placeholder}
        aria-label={he.nav.search}
        role="combobox"
        aria-expanded={!!shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        className="w-full rounded-full border border-neutral-200 bg-transparent px-4 py-2 outline-none focus:border-sky-500 dark:border-neutral-800 dark:focus:border-sky-500"
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800"
        >
          {!typing && (
            <li role="presentation" className="flex items-center justify-between px-4 py-1.5">
              <span className="font-bold">{he.search.recent}</span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => forget()}
                className="text-sm text-link hover:underline"
              >
                {he.search.clearRecent}
              </button>
            </li>
          )}
          {list.map((r, i) => (
            <li
              key={r.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus, then navigate
                go(r);
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm aria-selected:bg-neutral-500/10"
            >
              {!typing && (
                // Clock: a recent search
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-4 shrink-0 text-muted"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              )}
              <span className="min-w-0 flex flex-1 items-baseline gap-2">
                <span className={`truncate ${r.query && !typing ? "" : "font-bold"}`}>
                  <bdi>{r.label}</bdi>
                </span>
                {r.detail && (
                  <span
                    className="shrink-[3] truncate text-muted"
                    dir={r.ltrDetail ? "ltr" : undefined}
                  >
                    {r.detail}
                  </span>
                )}
              </span>
              {!typing && (
                <button
                  type="button"
                  aria-label={he.search.forget(r.label)}
                  onMouseDown={(e) => {
                    e.preventDefault(); // not the row
                    e.stopPropagation();
                    forget(r.href);
                  }}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-muted hover:bg-neutral-500/15 hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
