// "ניסיון" on a profile (docs/experience.md), LinkedIn-style: each role with its organization
// and location, month range and length. The owner adds and edits here; others only read, and
// see nothing when there is nothing. The service start and end (lib/service-info.ts) sit on the
// same timeline as quieter one-line rows.
import { ExperienceEditor } from "@/components/experience-editor";
import { duration, months } from "@/lib/experience";
import { monthYear } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { experienceOf } from "@/lib/services";

const month = (day: string) => monthYear(new Date(`${day}T12:00:00Z`));
const dayFormat = new Intl.DateTimeFormat("he", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fullDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));

type Role = Awaited<ReturnType<typeof experienceOf>>[number];
type Row = { role: Role; at: string } | { service: "start" | "end"; day: string; at: string };

export async function ExperienceSection(p: {
  userId: string;
  isOwner: boolean;
  serviceStart: string | null;
  serviceEnd: string | null;
}) {
  const roles = await experienceOf(p.userId);
  // Newest first by where each ends (a current role: on top); on a tie the role comes first.
  const rows: Row[] = [
    ...roles.map((role) => ({ role, at: role.endMonth ?? "9999-12-31" })),
    ...(p.serviceEnd ? [{ service: "end" as const, day: p.serviceEnd, at: p.serviceEnd }] : []),
    ...(p.serviceStart
      ? [{ service: "start" as const, day: p.serviceStart, at: p.serviceStart }]
      : []),
  ].sort((a, b) => b.at.localeCompare(a.at) || ("role" in a ? -1 : "role" in b ? 1 : 0));
  if (!rows.length && !p.isOwner) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section
      aria-labelledby="experience-title"
      className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 id="experience-title" className="text-lg font-bold">
          {he.experience.title}
        </h2>
        {p.isOwner && <ExperienceEditor />}
      </div>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {rows.map((row) =>
            "role" in row ? (
              <RoleRow key={row.role.id} r={row.role} isOwner={p.isOwner} />
            ) : (
              // Service start / end: one quiet line between the roles.
              <li key={row.service} className="flex items-center gap-2 py-2 text-xs text-muted">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {row.service === "start"
                  ? he.experience.serviceStart
                  : row.day > today
                    ? he.experience.serviceEndAhead
                    : he.experience.serviceEnd}
                {" · "}
                {fullDay(row.day)}
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{he.experience.empty}</p>
      )}
    </section>
  );
}

function RoleRow({ r, isOwner }: { r: Role; isOwner: boolean }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-bold">{r.title}</p>
        {(r.organization || r.location) && (
          <p className="text-sm">{[r.organization, r.location].filter(Boolean).join(" · ")}</p>
        )}
        <p className="text-sm text-muted">
          {month(r.startMonth)} – {r.endMonth ? month(r.endMonth) : he.experience.present}
          {" · "}
          {duration(months(r.startMonth.slice(0, 7), r.endMonth?.slice(0, 7) ?? null))}
        </p>
      </div>
      {isOwner && <ExperienceEditor entry={r} />}
    </li>
  );
}
