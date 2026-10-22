// Service details on a profile (lib/service-info.ts): rank and service type, location, days in
// service and days left to the release, and civilian phone and email as links. Only what the
// person filled in.
import {
  daysUntil,
  RANK_LABEL,
  SERVICE_TYPE_LABEL,
  serviceDays,
  type ServiceInfo,
} from "@/lib/service-info";
import { he } from "@/lib/i18n/he";

export function ServiceDetails({ info }: { info: ServiceInfo }) {
  const rank = RANK_LABEL[info.rank as keyof typeof RANK_LABEL];
  const type = SERVICE_TYPE_LABEL[info.serviceType as keyof typeof SERVICE_TYPE_LABEL];
  const items = [
    [rank, type].filter(Boolean).join(" · "),
    info.location,
    info.serviceStart && he.profile.serviceDays(serviceDays(info.serviceStart)),
    // Only while it is ahead: after the release there is nothing left to count.
    info.serviceEnd &&
      daysUntil(info.serviceEnd) > 0 &&
      he.profile.daysLeft(daysUntil(info.serviceEnd)),
  ].filter(Boolean);
  const contact = [
    info.civicPhone && {
      href: `tel:${info.civicPhone.replace(/[ -]/g, "")}`,
      text: info.civicPhone,
    },
    info.civicEmail && { href: `mailto:${info.civicEmail}`, text: info.civicEmail },
  ].filter((c): c is { href: string; text: string } => !!c);
  if (!items.length && !contact.length) return null;
  return (
    <div className="mt-2 space-y-1 text-sm">
      {items.length > 0 && <p className="text-muted">{items.join(" · ")}</p>}
      {contact.length > 0 && (
        <p className="flex flex-wrap gap-x-4">
          {contact.map((c) => (
            <a key={c.href} href={c.href} dir="ltr" className="text-link hover:underline">
              {c.text}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
