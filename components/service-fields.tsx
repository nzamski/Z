"use client";
// The profile form's service details (lib/service-info.ts). Controlled, so a failed save keeps
// what was typed. The browser checks the phone and email formats; the server checks again.
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

export function ServiceFields(p: { initial: ServiceInfo; field: string }) {
  const [v, setV] = useState(p.initial);
  const set = (k: keyof ServiceInfo) => (e: { target: { value: string } }) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));
  const year = new Date().getFullYear();
  const label = (text: string, input: React.ReactNode, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{text}</span>
      {input}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
  // A div, not a label: a label around buttons would pass its clicks to the first dropdown.
  const dateField = (text: string, input: React.ReactNode, hint: string) => (
    <div className="space-y-1 sm:col-span-2">
      <span className="block text-sm font-medium">{text}</span>
      {input}
      <span className="block text-xs text-muted">{hint}</span>
    </div>
  );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">{he.profile.service}</legend>
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
        {/* Phone and email share the last row. */}
        {label(
          he.profile.civicPhone,
          <input
            type="tel"
            name="civicPhone"
            value={v.civicPhone}
            onChange={set("civicPhone")}
            inputMode="tel"
            autoComplete="tel"
            pattern="\+?[0-9][0-9 \-]{5,18}[0-9]"
            dir="ltr"
            className={p.field}
          />,
        )}
        {label(
          he.profile.civicEmail,
          <input
            type="email"
            name="civicEmail"
            value={v.civicEmail}
            onChange={set("civicEmail")}
            autoComplete="email"
            maxLength={254}
            dir="ltr"
            className={p.field}
          />,
        )}
      </div>
    </fieldset>
  );
}
