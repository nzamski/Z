// Service details on a profile (lib/service-info.ts): rank (as its insignia), service type, age,
// days in service and days left to the release, and civilian phone and email. Only what the
// person filled in. Phone and email are plain text, not tel:/mailto: links: nothing on the
// air-gapped network would open them.
import { RankInsignia } from "@/components/rank-insignia";
import { he } from "@/lib/i18n/he";
import {
  age,
  daysUntil,
  isRank,
  SERVICE_TYPE_LABEL,
  serviceDays,
  type ServiceInfo,
} from "@/lib/service-info";

export function ServiceDetails({ info }: { info: ServiceInfo }) {
  const type = SERVICE_TYPE_LABEL[info.serviceType as keyof typeof SERVICE_TYPE_LABEL];
  const items = [
    isRank(info.rank) && <RankInsignia rank={info.rank} />,
    type,
    info.birthDate && he.profile.age(age(info.birthDate)),
    info.serviceStart && he.profile.serviceDays(serviceDays(info.serviceStart)),
    // Only while it is ahead: after the release there is nothing left to count.
    info.serviceEnd &&
      daysUntil(info.serviceEnd) > 0 &&
      he.profile.daysLeft(daysUntil(info.serviceEnd)),
  ].filter(Boolean);
  const contact = [info.civicPhone, info.civicEmail].filter(Boolean);
  if (!items.length && !contact.length) return null;
  return (
    <div className="mt-2 space-y-1 text-sm">
      {items.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-muted">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-x-1.5">
              {i > 0 && <span aria-hidden>·</span>}
              {item}
            </span>
          ))}
        </p>
      )}
      {contact.length > 0 && (
        <p className="flex flex-wrap gap-x-4">
          {contact.map((c) => (
            <span key={c} dir="ltr">
              {c}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
