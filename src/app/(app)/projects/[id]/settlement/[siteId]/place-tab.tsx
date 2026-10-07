import { PointsCatalog } from "@/components/settlement/points-catalog";
import { SiteDataButton } from "@/components/settlement/site-dialog";
import { undoRetirementBlocker } from "@/lib/validators/settlement";
import type { getSitePoints, getVisits } from "@/lib/supabase/queries";
import type { Site } from "@/types/site";

interface PlaceTabProps {
  projectId: string;
  site: Site;
  points: Awaited<ReturnType<typeof getSitePoints>>;
  visits: Awaited<ReturnType<typeof getVisits>>;
  /** Puntos con lecturas en visitas cerradas: C0 fija (Fase 23). */
  referenceLocked: string[];
}

/**
 * Pestaña Puntos y lugar (Fase 22): los datos y umbrales del lugar y su
 * catálogo de puntos de control. Hasta la Fase 21 era otra página,
 * `sites/[siteId]`, que ahora redirige aquí.
 */
export function PlaceTab({ projectId, site, points, visits, referenceLocked }: PlaceTabProps) {
  // Por cada punto de baja, si la baja todavía se puede deshacer (Fase 11).
  // La misma regla que aplica `undoRetirementAction` al ejecutarla.
  const closedVisits = visits
    .filter((v) => v.status === "closed")
    .map((v) => ({ visitNumber: v.visit_number, date: v.date }));
  const undoBlockers: Record<string, string | null> = {};
  for (const point of points) {
    if (point.retired_on !== null) {
      undoBlockers[point.id] = undoRetirementBlocker(point.retired_on, closedVisits);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Tarea 9: «Editar datos» pasa a la cabecera del lugar (Fase 37). */}
      <div className="flex justify-end">
        <SiteDataButton projectId={projectId} site={site} />
      </div>
      <PointsCatalog
        siteId={site.id}
        points={points}
        disabled={site.status === "closed"}
        hasVisits={visits.length > 0}
        undoBlockers={undoBlockers}
        referenceLocked={referenceLocked}
      />
    </div>
  );
}
