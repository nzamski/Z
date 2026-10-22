// Experience on a profile (docs/experience.md), LinkedIn-style: roles with an organization, a
// month range (no end: current). Pure: the editor form uses it too.

export const TITLE_MAX = 60;
export const ORGANIZATION_MAX = 60;
export const EXPERIENCE_MAX = 30; // roles per person

/** A month as the form sends it (`<input type="month">`): YYYY-MM, a real month. */
export const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

/** Stored as the first day of the month (a `date` column), shown as the month. */
export const monthToDay = (m: string) => `${m}-01`;
export const dayToMonth = (d: string) => d.slice(0, 7);

/** Months in a role, counting both ends (Jan-Mar is 3), up to today when there's no end. */
export function months(start: string, end: string | null, today = new Date()) {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end
    ? end.split("-").map(Number)
    : [today.getUTCFullYear(), today.getUTCMonth() + 1];
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

const years = (n: number) => (n === 1 ? "שנה" : n === 2 ? "שנתיים" : `${n} שנים`);
const monthsText = (n: number) => (n === 1 ? "חודש" : n === 2 ? "חודשיים" : `${n} חודשים`);

/** "שנתיים ו-3 חודשים", "חודש", "4 שנים". */
export function duration(total: number) {
  const [y, m] = [Math.floor(total / 12), total % 12];
  if (!y) return monthsText(m);
  if (!m) return years(y);
  return `${years(y)} ו${m > 2 ? "-" : ""}${monthsText(m)}`;
}
