// @mentions (docs/notifications.md): `@handle` in posts and comments links to the profile and
// notifies that user. Not inside code or links, not in e-mail addresses ("a@b.c").

import { HANDLE_RE } from "@/lib/limits";

export const MENTIONS_MAX = 10; // notified per post or comment, so a list of handles can't spam

// A handle exactly as HANDLE_RE allows (any case) after start or a non-word character. Built from
// HANDLE_RE so the two can't drift apart; letters are spelled out rather than using the `i` flag,
// which with `u` would also match look-alikes such as the Kelvin sign.
const HANDLE = HANDLE_RE.source.slice(1, -1).replaceAll("a-z", "a-zA-Z");
const MENTION = new RegExp(`(^|[^\\p{L}\\p{N}_@.])@(${HANDLE})(?![a-zA-Z0-9_])`, "gu");

/** Whether a handle can be mentioned: it must satisfy HANDLE_RE (rows written before a rule change
 * may not). */
export const mentionable = (handle: string) => HANDLE_RE.test(handle);

/** Splits plain text into text and mention parts (handles lowercased). */
export function splitMentions(text: string) {
  const parts: ({ text: string } | { handle: string; raw: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const at = m.index! + m[1].length;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ handle: m[2].toLowerCase(), raw: `@${m[2]}` });
    last = at + 1 + m[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
