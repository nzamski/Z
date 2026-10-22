"use client";
// Z's own date picker: day, month and year as Pick dropdowns (like the poll's duration), with
// Hebrew month names, instead of the browser's date input (which can't be styled and speaks the
// browser's language). Sends one hidden field: YYYY-MM-DD, or YYYY-MM with `month`; "" until
// every part is picked (the server then clears the date, or refuses it where it is required).
import { useState } from "react";
import { Pick } from "@/components/pick";
import { he } from "@/lib/i18n/he";

const monthName = new Intl.DateTimeFormat("he", { month: "long", timeZone: "UTC" });
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  monthName.format(new Date(Date.UTC(2000, i, 1))),
);
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, "0");

type Part = number | "";

/** Splits a stored value into its parts ("" where missing). */
function parts(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return { y: (y || "") as Part, m: (m || "") as Part, d: (d || "") as Part };
}

export function DatePick(p: {
  name: string;
  value: string; // YYYY-MM-DD (YYYY-MM with `month`), or ""
  onChange: (v: string) => void;
  month?: boolean; // month and year only
  fromYear: number;
  toYear: number;
}) {
  const [v, setV] = useState(() => parts(p.value));
  const compose = (n: typeof v) =>
    n.y && n.m && (p.month || n.d)
      ? `${n.y}-${pad(n.m as number)}${p.month ? "" : `-${pad(n.d as number)}`}`
      : "";
  const pick = (next: Partial<typeof v>) => {
    const n = { ...v, ...next };
    // A shorter month (or a non-leap February) keeps the day in range.
    if (n.d && n.m && n.y) n.d = Math.min(n.d, daysIn(n.y, n.m));
    setV(n);
    p.onChange(compose(n));
  };
  const none = (x: Part, show: (x: number) => string) => (x === "" ? he.profile.none : show(x));
  const years: Part[] = [""];
  for (let y = p.toYear; y >= p.fromYear; y--) years.push(y); // newest first
  const days: Part[] = [""];
  for (let d = 1; d <= (v.y && v.m ? daysIn(v.y, v.m) : 31); d++) days.push(d);
  return (
    // Right to left: day, month, year, the way dates are written in Hebrew.
    <div className="flex gap-2">
      <input type="hidden" name={p.name} value={compose(v)} />
      {!p.month && (
        <Pick
          label={he.date.day}
          value={v.d}
          values={days}
          format={(d) => none(d, String)}
          onPick={(d) => pick({ d })}
        />
      )}
      <Pick
        label={he.date.month}
        value={v.m}
        values={["", ...MONTH_NAMES.map((_, i) => i + 1)]}
        format={(m) => none(m, (m) => MONTH_NAMES[m - 1])}
        onPick={(m) => pick({ m })}
      />
      <Pick
        label={he.date.year}
        value={v.y}
        values={years}
        format={(y) => none(y, String)}
        onPick={(y) => pick({ y })}
      />
    </div>
  );
}
