// @mentions (docs/notifications.md): `@handle` in posts and comments links to the profile and
// notifies that user. Not inside code or links, not in e-mail addresses ("a@b.c").

export const MENTIONS_MAX = 10; // notified per post or comment, so a list of handles can't spam

// A handle after start or a non-word character. Looser than HANDLE_RE (4+ characters, for new
// handles) so older, shorter handles can be mentioned too; unknown handles are just not notified.
const MENTION = /(^|[^\p{L}\p{N}_@.])@([a-zA-Z][a-zA-Z0-9_]{1,14})(?![a-zA-Z0-9_])/gu;

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
