// A rank shown as its official insignia, which differs by arm (public/ranks/<arm>/, sources in
// ATTRIBUTION.md there; fetched by scripts/fetch-rank-insignia.sh). Officers and NCOs are shoulder
// boards (tall), enlisted ranks are stripes (wide). The name stays as alt text and tooltip.
// טוראי has no insignia: text. No arm set: the ground forces' insignia.
import { RANK_LABEL, type Rank, type ServiceArm } from "@/lib/service-info";

const ENLISTED = new Set<Rank>(["corporal", "sergeant", "staff_sergeant"]);
const NCO = new Set<Rank>([
  "sergeant_first_class",
  "master_sergeant",
  "sergeant_major",
  "warrant_officer",
  "chief_warrant_officer",
]);

/** The file's extension: what Commons has for that arm and rank (svg where there is one). */
function ext(arm: ServiceArm, rank: Rank) {
  if (NCO.has(rank)) return "png";
  if (ENLISTED.has(rank)) return arm === "ground" ? "svg" : "png";
  if (arm === "navy") return rank === "second_lieutenant" || rank === "major" ? "svg" : "png";
  return "svg";
}

export function RankInsignia({ rank, arm }: { rank: Rank; arm?: ServiceArm | null }) {
  const label = RANK_LABEL[rank];
  if (rank === "private") return <span>{label}</span>;
  const a = arm ?? "ground";
  return (
    // The tooltip sits on a wrapper: data-tip draws with ::after, which an <img> can't show.
    <span data-tip={label} className="inline-flex">
      {/* Small static files from public/: next/image's optimizer would add nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/ranks/${a}/${rank}.${ext(a, rank)}`}
        alt={label}
        loading="lazy"
        className={`inline-block w-auto ${ENLISTED.has(rank) ? "h-5" : "h-10"}`}
      />
    </span>
  );
}
