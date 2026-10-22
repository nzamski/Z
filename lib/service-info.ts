// Service details on a profile (docs/service-info.md): rank, service type and start date (days in
// service), base or location, and civilian contact. All optional and self-reported; visible to every
// logged-in user. No DB imports: the profile form uses it too. The database checks the rank and
// service type lists (db/schema.ts builds them from these), so a new value needs `npm run db:generate`.

/** Ranks, lowest first (enlisted, NCOs, officers). */
export const RANKS = [
  "private",
  "corporal",
  "sergeant",
  "staff_sergeant",
  "sergeant_first_class",
  "master_sergeant",
  "sergeant_major",
  "warrant_officer",
  "chief_warrant_officer",
  "second_lieutenant",
  "lieutenant",
  "captain",
  "major",
  "lieutenant_colonel",
  "colonel",
  "brigadier_general",
  "major_general",
  "lieutenant_general",
] as const;
export type Rank = (typeof RANKS)[number];
export const RANK_LABEL: Record<Rank, string> = {
  private: "טוראי",
  corporal: "רב״ט",
  sergeant: "סמל",
  staff_sergeant: "סמ״ר",
  sergeant_first_class: "רס״ל",
  master_sergeant: "רס״ר",
  sergeant_major: "רס״מ",
  warrant_officer: "רס״ב",
  chief_warrant_officer: "רנ״ג",
  second_lieutenant: "סג״ם",
  lieutenant: "סגן",
  captain: "סרן",
  major: "רס״ן",
  lieutenant_colonel: "סא״ל",
  colonel: "אל״ם",
  brigadier_general: "תא״ל",
  major_general: "אלוף",
  lieutenant_general: "רא״ל",
};
export const isRank = (v: unknown): v is Rank => RANKS.includes(v as Rank);

export const SERVICE_TYPES = ["regular", "career", "reserves", "civilian"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  regular: "סדיר",
  career: "קבע",
  reserves: "מילואים",
  civilian: "אזרח/ית",
};
export const isServiceType = (v: unknown): v is ServiceType =>
  SERVICE_TYPES.includes(v as ServiceType);

/** YYYY-MM-DD and a real day (not 2026-02-30). */
function isDay(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** A service start date as stored: a real day, not in the future, within 60 years. */
export function isServiceStart(v: string, today = new Date()) {
  if (!isDay(v)) return false;
  const days = serviceDays(v, today);
  return days >= 0 && days <= 60 * 366;
}

/** A service end (release) date: a real day within 60 years back and 40 ahead. The service layer
 * also requires it after the start date. */
export function isServiceEnd(v: string, today = new Date()) {
  if (!isDay(v)) return false;
  const left = daysUntil(v, today);
  return left >= -60 * 366 && left <= 40 * 366;
}

/** Days in service (פז״ם) from the start date to today, counted in whole UTC days. */
export function serviceDays(start: string, today = new Date()) {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((t - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

/** Days from today until a date (release): negative once it has passed. */
export const daysUntil = (day: string, today = new Date()) => -serviceDays(day, today);

export const LOCATION_MAX = 40;

/** Civilian phone as typed: digits with optional leading +, spaces and dashes (7-15 digits). */
export const isPhone = (v: string) =>
  /^\+?[0-9][0-9 -]*[0-9]$/.test(v) &&
  v.replace(/\D/g, "").length >= 7 &&
  v.replace(/\D/g, "").length <= 15;

/** Civilian email: one @, a dot in the domain, no spaces; 254 chars at most (RFC 5321). */
export const isEmail = (v: string) => v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/** The service details as stored and edited. */
export type ServiceInfo = {
  rank: string | null;
  serviceType: string | null;
  serviceStart: string | null;
  serviceEnd: string | null;
  location: string;
  civicPhone: string;
  civicEmail: string;
};
