"use client";
// The composer's emoji button: every single-character emoji, built in the browser from Unicode
// properties (air-gapped: no emoji library, CDN or data file; a page can't open the OS picker).
// Not included: multi-part emoji (flags, skin tones, families), which need a data file. Recently
// used ones (per browser) come first. Opens upward, so a popup around the composer doesn't clip
// it; picking inserts at the caret and keeps the editor's focus.
import { useState } from "react";
import { menuBox, useMenu } from "@/components/theme-menu";
import { he } from "@/lib/i18n/he";

// Where emoji live: misc technical, misc symbols and dingbats, arrows and stars, the emoji planes.
const RANGES = [
  [0x2300, 0x23ff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1faff],
];
let all: string[] | null = null;
/** Every single-code-point emoji, in code point order (which keeps related ones together). */
function allEmoji() {
  if (all) return all;
  all = [];
  for (const [from, to] of RANGES)
    for (let cp = from; cp <= to; cp++) {
      const c = String.fromCodePoint(cp);
      if (/\p{Emoji_Presentation}/u.test(c)) all.push(c);
      // Text-style by default (❤, ☕…): the variation selector asks for the emoji look.
      else if (cp < 0x1f000 && /\p{Extended_Pictographic}/u.test(c)) all.push(c + "️");
    }
  return all;
}

const RECENT = "z-emoji-recent";
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? "[]");
  } catch {
    return [];
  }
};

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { open, setOpen, root } = useMenu();
  const [recent, setRecent] = useState<string[]>([]);
  const pick = (e: string) => {
    const next = [e, ...recent.filter((r) => r !== e)].slice(0, 16);
    setRecent(next);
    try {
      localStorage.setItem(RECENT, JSON.stringify(next));
    } catch {}
    onPick(e);
    setOpen(false);
  };
  const grid = (list: string[]) => (
    <div className="grid grid-cols-8 gap-0.5">
      {list.map((e) => (
        <button
          key={e}
          type="button"
          onMouseDown={(ev) => ev.preventDefault()}
          onClick={() => pick(e)}
          className="grid size-8 place-items-center rounded-md text-xl hover:bg-neutral-500/15"
        >
          {e}
        </button>
      ))}
    </div>
  );
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
        onClick={() => {
          if (!open) setRecent(readRecent());
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={he.composer.emoji}
        data-tip={he.composer.emoji}
        className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-neutral-500/10 hover:text-foreground aria-expanded:bg-neutral-500/15 aria-expanded:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="size-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={he.composer.emoji}
          className={`absolute end-0 bottom-full mb-1 max-h-72 w-max overflow-y-auto p-1.5 ${menuBox}`}
        >
          {recent.length > 0 && (
            <>
              <p className="px-1 pb-1 text-xs text-muted">{he.composer.emojiRecent}</p>
              {grid(recent)}
              <hr className="my-1.5 border-neutral-200 dark:border-neutral-800" />
            </>
          )}
          {grid(allEmoji())}
        </div>
      )}
    </div>
  );
}
