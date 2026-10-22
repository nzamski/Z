// A user's profession badge (lib/professions.ts), beside their @handle. A link to everyone with
// that badge (search), unless it sits inside another link (`link={false}`).
import Link from "next/link";
import { isProfession, PROFESSION_COLOR, PROFESSION_LABEL } from "@/lib/professions";

export const professionHref = (p: string) => `/search?profession=${p}`;

export function ProfessionBadge(p: { profession: string | null; link?: boolean }) {
  if (!isProfession(p.profession)) return null;
  const className = `inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PROFESSION_COLOR[p.profession]}`;
  return p.link === false ? (
    <span className={className}>{PROFESSION_LABEL[p.profession]}</span>
  ) : (
    <Link href={professionHref(p.profession)} className={`${className} hover:opacity-80`}>
      {PROFESSION_LABEL[p.profession]}
    </Link>
  );
}
