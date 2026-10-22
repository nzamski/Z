// Service details on a profile (lib/service-info.ts): rank (as its insignia), service type,
// days in service and days left to the release, and civilian phone and email. Only what the
// person filled in. Phone and email are plain text, not tel:/mailto: links: nothing on the
// air-gapped network would open them.
import { RankInsignia } from "@/components/rank-insignia";
import { he } from "@/lib/i18n/he";
import {
  daysUntil,
  isRank,
  isServiceArm,
  SERVICE_TYPE_LABEL,
  serviceDays,
  type ServiceInfo,
} from "@/lib/service-info";

// Outline icons, like the profile's "joined" calendar.
const PHONE = (
  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
);
const MAIL = (
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </>
);

export function ServiceDetails({ info }: { info: ServiceInfo }) {
  const type = SERVICE_TYPE_LABEL[info.serviceType as keyof typeof SERVICE_TYPE_LABEL];
  const items = [
    isRank(info.rank) && (
      <RankInsignia rank={info.rank} arm={isServiceArm(info.serviceArm) ? info.serviceArm : null} />
    ),
    type,
    info.serviceStart && he.profile.serviceDays(serviceDays(info.serviceStart)),
    // Only while it is ahead: after the release there is nothing left to count.
    info.serviceEnd &&
      daysUntil(info.serviceEnd) > 0 &&
      he.profile.daysLeft(daysUntil(info.serviceEnd)),
  ].filter(Boolean);
  const contact = [
    info.civicPhone && { icon: PHONE, text: info.civicPhone },
    info.civicEmail && { icon: MAIL, text: info.civicEmail },
  ].filter((c): c is { icon: React.JSX.Element; text: string } => !!c);
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
            <span key={c.text} className="inline-flex items-center gap-1">
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="size-4 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {c.icon}
              </svg>
              <span dir="ltr">{c.text}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
