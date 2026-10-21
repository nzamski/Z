const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

// ICU appends the count to Hebrew singular/dual forms ("לפני שעתיים (2)"); drop it.
const fmt = (n: number, unit: Intl.RelativeTimeFormatUnit) =>
  rtf.format(n, unit).replace(/ \(\d+\)/, "");

export function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return fmt(-min, "minute");
  if (min < 24 * 60) return fmt(-Math.round(min / 60), "hour");
  return fmt(-Math.round(min / (24 * 60)), "day");
}

/** "בעוד יומיים": time left until `d` (a poll's end). */
export function until(d: Date) {
  const min = Math.max(1, Math.round((d.getTime() - Date.now()) / 60_000));
  if (min < 60) return fmt(min, "minute");
  if (min < 24 * 60) return fmt(Math.round(min / 60), "hour");
  return fmt(Math.round(min / (24 * 60)), "day");
}

/** First line of a text, cut to `n` characters at a word boundary: for page titles. */
export function snippet(text: string, n = 60) {
  const line = text.trim().split("\n")[0];
  if (line.length <= n) return line;
  const cut = line.slice(0, n);
  return `${cut.slice(0, cut.lastIndexOf(" ") > n / 2 ? cut.lastIndexOf(" ") : n)}…`;
}

const my = new Intl.DateTimeFormat("he", { month: "long", year: "numeric" });

/** "אוקטובר 2026" */
export const monthYear = (d: Date) => my.format(d);

const dt = new Intl.DateTimeFormat("he", { dateStyle: "short", timeStyle: "short" });

/** "19.10.2026, 14:05": exact times for the moderation log. */
export const dateTime = (d: Date) => dt.format(d);
