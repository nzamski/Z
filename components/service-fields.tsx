"use client";
// The service details' fields (lib/service-info.ts), in their own popup (ServiceEditor).
// Controlled, so a failed save keeps what was picked; the server checks everything again.
import { useState } from "react";
import { DatePick } from "@/components/date-pick";
import { Pick } from "@/components/pick";
import { RankInsignia } from "@/components/rank-insignia";
import { he } from "@/lib/i18n/he";
import {
  RANK_LABEL,
  RANKS,
  SERVICE_ARM_LABEL,
  SERVICE_ARMS,
  SERVICE_TYPE_LABEL,
  SERVICE_TYPES,
  type Rank,
  type ServiceArm,
  type ServiceInfo,
  type ServiceType,
} from "@/lib/service-info";

export function ServiceFields(p: { initial: ServiceInfo }) {
  const [v, setV] = useState(p.initial);
  const year = new Date().getFullYear();
  // A div, not a label: a label around buttons would pass its clicks to the first dropdown.
  const dateField = (text: string, input: React.ReactNode, hint: string) => (
    <div className="space-y-1 sm:col-span-2">
      <span className="block text-sm font-medium">{text}</span>
      {input}
      <span className="block text-xs text-muted">{hint}</span>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{he.profile.serviceVisible}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Z's own dropdowns, like the poll's (the label sits inside the button); "" is none.
            Arm first: the rank list shows that arm's insignia. */}
        <div className="flex gap-2 sm:col-span-2">
          <Pick
            label={he.profile.serviceArm}
            name="serviceArm"
            value={(v.serviceArm ?? "") as ServiceArm | ""}
            values={["", ...SERVICE_ARMS]}
            format={(a) => (a ? SERVICE_ARM_LABEL[a] : he.profile.none)}
            onPick={(a) => setV((cur) => ({ ...cur, serviceArm: a || null }))}
          />
          <Pick
            label={he.profile.rank}
            name="rank"
            value={(v.rank ?? "") as Rank | ""}
            values={["", ...RANKS]}
            format={(r) =>
              r ? (
                <span className="inline-flex items-center gap-2">
                  <RankInsignia rank={r} arm={v.serviceArm as ServiceArm | null} />
                  {r !== "private" && RANK_LABEL[r]}
                </span>
              ) : (
                he.profile.none
              )
            }
            onPick={(r) => setV((cur) => ({ ...cur, rank: r || null }))}
          />
          <Pick
            label={he.profile.serviceType}
            name="serviceType"
            value={(v.serviceType ?? "") as ServiceType | ""}
            values={["", ...SERVICE_TYPES]}
            format={(t) => (t ? SERVICE_TYPE_LABEL[t] : he.profile.none)}
            onPick={(t) => setV((cur) => ({ ...cur, serviceType: t || null }))}
          />
        </div>
        {/* Dates take the whole row: day, month and year side by side (DatePick). */}
        {dateField(
          he.profile.serviceStart,
          <DatePick
            name="serviceStart"
            value={v.serviceStart ?? ""}
            onChange={(d) => setV((cur) => ({ ...cur, serviceStart: d || null }))}
            fromYear={year - 60}
            toYear={year}
          />,
          he.profile.serviceStartHint,
        )}
        {dateField(
          he.profile.serviceEnd,
          <DatePick
            name="serviceEnd"
            value={v.serviceEnd ?? ""}
            onChange={(d) => setV((cur) => ({ ...cur, serviceEnd: d || null }))}
            fromYear={year - 60}
            toYear={year + 40}
          />,
          he.profile.serviceEndHint,
        )}
      </div>
    </div>
  );
}
