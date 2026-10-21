// #topics (docs/topics.md): `#kubernetes` or `#תשתיות` in a post links to the topic page and files
// the post under it. Not inside code or links, not in "page#section" or "#123" (issue numbers).

export const TAG_MAX = 30; // characters
export const TAGS_MAX = 10; // per post, so a wall of tags can't spray a post across topics

// A letter, then letters (with their marks, e.g. niqqud), digits and "_", with single inner "-"s.
const BODY = String.raw`\p{L}[\p{L}\p{M}\p{N}_]*(?:-[\p{L}\p{M}\p{N}_]+)*`;
const TAG = new RegExp(
  String.raw`(^|[^\p{L}\p{M}\p{N}_#&/])#(${BODY})(?![\p{L}\p{M}\p{N}_-])`,
  "gu",
);
const WHOLE = new RegExp(String.raw`^${BODY}$`, "u");

/** One spelling per topic: "K8s" and "k8s" are the same (Hebrew has no case). */
export const normalizeTag = (t: string) => t.normalize("NFC").toLowerCase();

/** A valid tag (without the "#"), e.g. from a URL or a search. */
export const isTag = (t: string) => t.length <= TAG_MAX && WHOLE.test(t);

/** Splits plain text into text and tag parts (tags normalized). */
export function splitTags(text: string) {
  const parts: ({ text: string } | { tag: string; raw: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m[2].length > TAG_MAX) continue;
    const at = m.index! + m[1].length;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ tag: normalizeTag(m[2]), raw: `#${m[2]}` });
    last = at + 1 + m[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export const tagHref = (tag: string) => `/t/${encodeURIComponent(tag)}`;
