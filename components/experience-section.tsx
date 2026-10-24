// "ניסיון" on a profile (docs/experience.md), LinkedIn-style: each role with its unit
// and location, month range and length. The owner adds and edits here; others only read, and
// see nothing when there is nothing.
import Link from "next/link";
import { ExperienceEditor } from "@/components/experience-editor";
import { duration, months, unitHref } from "@/lib/experience";
import { monthYear } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { experienceOf } from "@/lib/services";

const month = (day: string) => monthYear(new Date(`${day}T12:00:00Z`));

export async function ExperienceSection(p: { userId: string; isOwner: boolean }) {
  const roles = await experienceOf(p.userId);
  if (!roles.length && !p.isOwner) return null;
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
      {roles.length ? (
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {roles.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-bold">{r.title}</p>
                {(r.unit || r.location) && (
                  <p className="text-sm">
                    {/* The unit links to everyone who has had a role there (peopleInUnit). */}
                    {r.unit && (
                      <Link
                        href={unitHref(r.unit)}
                        aria-label={he.experience.unitLink(r.unit)}
                        className="hover:underline"
                      >
                        {r.unit}
                      </Link>
                    )}
                    {r.unit && r.location && " · "}
                    {r.location}
                  </p>
                )}
                <p className="text-sm text-muted">
                  {month(r.startMonth)} – {r.endMonth ? month(r.endMonth) : he.experience.present}
                  {" · "}
                  {duration(months(r.startMonth.slice(0, 7), r.endMonth?.slice(0, 7) ?? null))}
                </p>
              </div>
              {p.isOwner && <ExperienceEditor entry={r} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{he.experience.empty}</p>
      )}
    </section>
  );
}
