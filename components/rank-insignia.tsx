// A rank shown as its official insignia (public/ranks/, see ATTRIBUTION.md there; fetched by
// scripts/fetch-rank-insignia.sh). Officers and NCOs are shoulder boards (tall), enlisted ranks
// are stripes (wide). The name stays as alt text and tooltip. טוראי has no insignia: text.
import { RANK_LABEL, type Rank } from "@/lib/service-info";

const FILE: Record<Rank, { src: string; tall: boolean } | null> = {
  private: null,
  corporal: { src: "corporal.svg", tall: false },
  sergeant: { src: "sergeant.svg", tall: false },
  staff_sergeant: { src: "staff_sergeant.svg", tall: false },
  sergeant_first_class: { src: "sergeant_first_class.png", tall: true },
  master_sergeant: { src: "master_sergeant.png", tall: true },
  sergeant_major: { src: "sergeant_major.png", tall: true },
  warrant_officer: { src: "warrant_officer.png", tall: true },
  chief_warrant_officer: { src: "chief_warrant_officer.png", tall: true },
  second_lieutenant: { src: "second_lieutenant.svg", tall: true },
  lieutenant: { src: "lieutenant.svg", tall: true },
  captain: { src: "captain.svg", tall: true },
  major: { src: "major.svg", tall: true },
  lieutenant_colonel: { src: "lieutenant_colonel.svg", tall: true },
  colonel: { src: "colonel.svg", tall: true },
  brigadier_general: { src: "brigadier_general.svg", tall: true },
  major_general: { src: "major_general.svg", tall: true },
  lieutenant_general: { src: "lieutenant_general.svg", tall: true },
};

export function RankInsignia({ rank }: { rank: Rank }) {
  const f = FILE[rank];
  const label = RANK_LABEL[rank];
  if (!f) return <span>{label}</span>;
  return (
    // Small static files from public/: next/image's optimizer would add nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ranks/${f.src}`}
      alt={label}
      data-tip={label}
      loading="lazy"
      className={`inline-block w-auto ${f.tall ? "h-10" : "h-5"}`}
    />
  );
}
