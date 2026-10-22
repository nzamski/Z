"use client";
// The profile form's service details (lib/service-info.ts). Controlled, so a failed save keeps
// what was typed. The browser checks the phone and email formats; the server checks again.
import { useState } from "react";
import { he } from "@/lib/i18n/he";
import {
  LOCATION_MAX,
  RANK_LABEL,
  RANKS,
  SERVICE_TYPE_LABEL,
  SERVICE_TYPES,
  type ServiceInfo,
} from "@/lib/service-info";

export function ServiceFields(p: { initial: ServiceInfo; field: string }) {
  const [v, setV] = useState(p.initial);
  const set = (k: keyof ServiceInfo) => (e: { target: { value: string } }) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);
  const label = (text: string, input: React.ReactNode, hint?: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{text}</span>
      {input}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">{he.profile.service}</legend>
      <p className="text-xs text-muted">{he.profile.serviceVisible}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {label(
          he.profile.rank,
          <select name="rank" value={v.rank ?? ""} onChange={set("rank")} className={p.field}>
            <option value="">{he.profile.none}</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {RANK_LABEL[r]}
              </option>
            ))}
          </select>,
        )}
        {label(
          he.profile.serviceType,
          <select
            name="serviceType"
            value={v.serviceType ?? ""}
            onChange={set("serviceType")}
            className={p.field}
          >
            <option value="">{he.profile.none}</option>
            {SERVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {SERVICE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>,
        )}
        {label(
          he.profile.serviceStart,
          <input
            type="date"
            name="serviceStart"
            value={v.serviceStart ?? ""}
            onChange={set("serviceStart")}
            max={today}
            className={p.field}
          />,
          he.profile.serviceStartHint,
        )}
        {label(
          he.profile.serviceEnd,
          <input
            type="date"
            name="serviceEnd"
            value={v.serviceEnd ?? ""}
            onChange={set("serviceEnd")}
            min={v.serviceStart ?? undefined}
            className={p.field}
          />,
          he.profile.serviceEndHint,
        )}
        {label(
          he.profile.location,
          <input
            name="location"
            value={v.location}
            onChange={set("location")}
            maxLength={LOCATION_MAX}
            className={p.field}
          />,
        )}
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
