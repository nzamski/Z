// Profession badges: each person may pick one for their profile (or none). No DB imports: the
// profile form and the badge use it too. The database checks the same list (users_profession_ck);
// adding one needs a migration that replaces that check.
export const PROFESSIONS = [
  "developer",
  "devops",
  "data_engineer",
  "data_scientist",
  "qa",
  "data_analyst",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const isProfession = (v: unknown): v is Profession => PROFESSIONS.includes(v as Profession);

export const PROFESSION_LABEL: Record<Profession, string> = {
  developer: "תוכניתן",
  devops: "DevOps",
  data_engineer: "Data Engineer",
  data_scientist: "Data Scientist",
  qa: "QA",
  data_analyst: "Data Analyst",
};

// One color each, so badges tell apart at a glance (light and dark).
export const PROFESSION_COLOR: Record<Profession, string> = {
  developer: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  devops: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  data_engineer: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  data_scientist: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  qa: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  data_analyst: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};
