// A person's role under their name in lists and the hover card (docs/experience.md): title and
// unit, and "former" for a past role (search can match one).
import { he } from "@/lib/i18n/he";
import type { RoleLine as Role } from "@/lib/services";

export function RoleLine(p: { role: Role | null | undefined; className?: string }) {
  if (!p.role) return null;
  return (
    <p className={`truncate text-sm ${p.className ?? ""}`}>
      {[p.role.title, p.role.unit].filter(Boolean).join(" · ")}
      {!p.role.current && <span className="text-muted"> ({he.experience.former})</span>}
    </p>
  );
}
