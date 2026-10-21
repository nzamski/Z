"use client";
// The sidebar's search box, with suggestions as you type: people and topics (the composer's
// autocomplete actions), and "search for …". ↑/↓ choose, Enter opens; Enter with nothing chosen
// searches. A plain GET form underneath, so it works before hydration too.
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { mentionSuggestionsAction, topicSuggestionsAction } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { tagHref } from "@/lib/tags";

type Row = { href: string; label: string; detail?: string; ltrDetail?: boolean };

export function SidebarSearch() {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);

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
        { href: `/search?q=${encodeURIComponent(text)}`, label: he.search.searchFor(text) },
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

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const shown = open && q.trim() && rows.length > 0;

  return (
    <form
      ref={box}
      action="/search"
      role="search"
      className="relative"
      onSubmit={(e) => {
        if (active < 0) return; // a plain search
        e.preventDefault();
        go(rows[active].href);
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
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            // -1 is "nothing chosen" (Enter searches); Up from the first row goes back to it.
            setActive((a) =>
              e.key === "ArrowDown" ? Math.min(a + 1, rows.length - 1) : Math.max(a - 1, -1),
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
          {rows.map((r, i) => (
            <li
              key={r.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus, then navigate
                go(r.href);
              }}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-baseline gap-2 px-4 py-2 text-sm aria-selected:bg-neutral-500/10"
            >
              <span className="truncate font-bold">
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
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
