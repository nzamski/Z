"use client";
// The composer's emoji button: frimousse (unstyled, styled here like Z's menus) with categories
// and search. Its emoji data is served by Z (scripts/copy-emojibase.mjs → /emojibase), never a
// CDN (air-gapped). All in English, button included: emojibase's names and categories have no
// Hebrew, so search is in English anyway. Fixed to the screen, below the button
// when there's room and above when not, so neither the page edge nor a popup around the composer
// cuts it off. Picking inserts at the caret and keeps the editor's focus.
import { EmojiPicker as Picker } from "frimousse";
import { useState } from "react";
import { menuBox, useMenu } from "@/components/theme-menu";

const W = 304; // px: 8 emoji columns and padding
const H = 336; // px: the picker's height (h-80) and a little room
const T = { label: "Emoji", search: "Search emoji", none: "No emoji found" };

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { open, setOpen, root } = useMenu();
  const [at, setAt] = useState({ top: 0, left: 0 });
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({
            top: innerHeight - r.bottom >= H ? r.bottom + 4 : Math.max(8, r.top - H),
            left: Math.max(8, Math.min(r.right - W, innerWidth - W - 8)),
          });
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={T.label}
        data-tip={T.label}
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
          aria-label={T.label}
          style={{ top: at.top, left: at.left, width: W }}
          className={`fixed ${menuBox}`}
        >
          <Picker.Root
            emojibaseUrl="/emojibase"
            columns={8}
            onEmojiSelect={({ emoji }) => {
              onPick(emoji);
              setOpen(false);
            }}
            className="isolate flex h-80 flex-col"
            dir="ltr"
          >
            <Picker.Search
              autoFocus
              placeholder={T.search}
              className="z-10 mx-2 mt-2 mb-1 appearance-none rounded-lg bg-neutral-500/10 px-2.5 py-1.5 text-sm outline-none placeholder:text-muted"
            />
            <Picker.Viewport className="relative flex-1 outline-none">
              <Picker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                …
              </Picker.Loading>
              <Picker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                {T.none}
              </Picker.Empty>
              <Picker.List
                className="pb-1.5 select-none"
                components={{
                  CategoryHeader: ({ category, ...props }) => (
                    <div
                      className="bg-background px-3 pt-3 pb-1.5 text-xs font-medium text-muted"
                      {...props}
                    >
                      {category.label}
                    </div>
                  ),
                  Row: ({ children, ...props }) => (
                    // Frimousse lays rows out with flex; each emoji takes 1/8 (columns={8}), so
                    // the grid reaches the scrollbar.
                    <div className="scroll-my-1.5 px-1.5" {...props}>
                      {children}
                    </div>
                  ),
                  Emoji: ({ emoji, ...props }) => (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      className="flex h-8 w-1/8 shrink-0 items-center justify-center rounded-md text-xl data-[active]:bg-neutral-500/15"
                      {...props}
                    >
                      {emoji.emoji}
                    </button>
                  ),
                }}
              />
            </Picker.Viewport>
          </Picker.Root>
        </div>
      )}
    </div>
  );
}
