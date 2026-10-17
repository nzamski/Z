const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

export function ago(d: Date) {
  const min = Math.round((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return rtf.format(-min, "minute");
  if (min < 24 * 60) return rtf.format(-Math.round(min / 60), "hour");
  return rtf.format(-Math.round(min / (24 * 60)), "day");
}
