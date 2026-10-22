// Profession badges: each person may pick one for their profile (or none). No DB imports: the
// profile form and the badge use it too. The database checks the same list (users_profession_ck);
// adding one: list it here, then `npm run db:generate` (db/schema.ts builds the check from this).
export const PROFESSIONS = [
  "developer",
  "devops",
  "data_engineer",
  "data_scientist",
  "qa",
  "data_analyst",
  "ml_engineer",
  "architect",
  "product_manager",
  "ux_ui",
  "cyber",
  "team_lead",
] as const;
export type Profession = (typeof PROFESSIONS)[number];

export const isProfession = (v: unknown): v is Profession => PROFESSIONS.includes(v as Profession);

export const PROFESSION_LABEL: Record<Profession, string> = {
  developer: "Developer",
  devops: "DevOps",
  data_engineer: "Data Engineer",
  data_scientist: "Data Scientist",
  qa: "QA",
  data_analyst: "Data Analyst",
  ml_engineer: "ML Engineer",
  architect: "Architect",
  product_manager: "Product Manager",
  ux_ui: "UX / UI",
  cyber: "Cyber",
  team_lead: "Team Lead",
};

// One color each, so badges tell apart at a glance (light and dark).
export const PROFESSION_COLOR: Record<Profession, string> = {
  developer: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  devops: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  data_engineer: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  data_scientist: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  qa: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  data_analyst: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ml_engineer: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  architect: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  product_manager: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  ux_ui: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
  cyber: "bg-lime-500/15 text-lime-800 dark:text-lime-300",
  team_lead: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};
