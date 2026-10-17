// Feed preview of a plain-text post, computed on save (PLAN.md §6.3; markdown is off for now).
// Keeps at most `maxLines` lines and `limit` characters, cutting at a word boundary.
export function computePreview(body: string, limit = 500, maxLines = 10) {
  let cut = body.split("\n").slice(0, maxLines).join("\n");
  if (cut.length > limit) {
    cut = cut.slice(0, limit);
    const space = cut.search(/\s\S*$/);
    if (space > limit / 2) cut = cut.slice(0, space); // else one huge word: hard cut
  }
  const hasMore = cut.length < body.length;
  return { preview: hasMore ? cut.trimEnd() : body, hasMore };
}
