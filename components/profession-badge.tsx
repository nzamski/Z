// A user's profession badge (lib/professions.ts), beside their @handle.
import { isProfession, PROFESSION_COLOR, PROFESSION_LABEL } from "@/lib/professions";

export function ProfessionBadge({ profession }: { profession: string | null }) {
  if (!isProfession(profession)) return null;
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${PROFESSION_COLOR[profession]}`}
    >
      {PROFESSION_LABEL[profession]}
    </span>
  );
}
