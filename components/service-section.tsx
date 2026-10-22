// "פרטי שירות" on a profile, its own section between the profile and the experience
// (lib/service-info.ts): rank, arm and service type, days in service and days left to the
// release. The insignia itself sits beside the name in the profile header. The owner edits here
// (ServiceEditor); others see nothing when there is nothing.
import { ServiceEditor } from "@/components/service-editor";
import { he } from "@/lib/i18n/he";
import {
  daysUntil,
  RANK_LABEL,
  SERVICE_ARM_LABEL,
  SERVICE_TYPE_LABEL,
  serviceDays,
  type ServiceInfo,
} from "@/lib/service-info";

const label = <T extends string>(labels: Record<T, string>, v: string | null) =>
  v ? labels[v as T] : undefined;

export function ServiceSection({ info, isOwner }: { info: ServiceInfo; isOwner: boolean }) {
  const items = [
    label(RANK_LABEL, info.rank),
    label(SERVICE_ARM_LABEL, info.serviceArm),
    label(SERVICE_TYPE_LABEL, info.serviceType),
    info.serviceStart && he.profile.serviceDays(serviceDays(info.serviceStart)),
    // Only while it is ahead: after the release there is nothing left to count.
    info.serviceEnd &&
      daysUntil(info.serviceEnd) > 0 &&
      he.profile.daysLeft(daysUntil(info.serviceEnd)),
  ].filter(Boolean);
  if (!items.length && !isOwner) return null;
  return (
    <section
      aria-labelledby="service-title"
      className="border-b border-neutral-200 p-4 text-start dark:border-neutral-800"
    >
      <div className="flex items-center justify-between">
        <h2 id="service-title" className="text-lg font-bold">
          {he.profile.service}
        </h2>
        {isOwner && <ServiceEditor initial={info} />}
      </div>
      <p className="mt-1 text-sm text-muted">
        {items.length ? items.join(" · ") : he.profile.serviceEmpty}
      </p>
    </section>
  );
}
