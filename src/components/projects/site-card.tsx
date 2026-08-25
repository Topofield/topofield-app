import Link from "next/link";
import { Badge, StatusIndicator } from "@/components/design-system";
import { formatDate, formatRelativeDate } from "@/lib/utils/format";
import { ALERT_LEVEL_LABELS, type AlertLevel } from "@/types/settlement";
import { SITE_STATUS_LABELS, STRUCTURE_TYPE_LABELS, type Site } from "@/types/site";

interface SiteCardProps {
  projectId: string;
  site: Site;
  /** Cuántas visitas tiene registradas el lugar. */
  visitCount: number;
  /** Peor nivel de alerta entre todas sus visitas, ya calculado por `computeHistory`. */
  worstAlert: AlertLevel;
}

/**
 * Tarjeta de lugar del hub, análoga a `ProcessCard` pero para el control de
 * asentamientos: un lugar agrupa visitas, así que la tarjeta muestra cuántas
 * tiene y su peor alerta en vez de un semáforo de tolerancia único.
 *
 * Lleva al panel de análisis (`settlement/[siteId]`), no al editor del lugar
 * (`sites/[siteId]`): es la vista que interesa desde el hub. El editor queda
 * a un clic desde ahí (enlace cruzado en el propio panel).
 */
export function SiteCard({ projectId, site, visitCount, worstAlert }: SiteCardProps) {
  return (
    <Link
      href={`/projects/${projectId}/settlement/${site.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {STRUCTURE_TYPE_LABELS[site.structure_type]}
          </p>
          <h3 className="mt-0.5 font-semibold">{site.name}</h3>
        </div>
        <Badge tone={site.status === "closed" ? "success" : "neutral"}>
          {SITE_STATUS_LABELS[site.status]}
        </Badge>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <StatusIndicator level={worstAlert} label={ALERT_LEVEL_LABELS[worstAlert]} />
        <span>
          {visitCount} {visitCount === 1 ? "visita" : "visitas"}
        </span>
        <span className="shrink-0" title={formatDate(site.updated_at)}>
          {formatRelativeDate(site.updated_at)}
        </span>
      </div>
    </Link>
  );
}
