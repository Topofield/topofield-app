import { PointsCatalog } from "@/components/settlement/points-catalog";
import { SiteForm } from "@/components/settlement/site-form";
import { undoRetirementBlocker } from "@/lib/validators/settlement";
import type { getSitePoints, getVisits } from "@/lib/supabase/queries";
import type { Site } from "@/types/site";

interface PlaceTabProps {
  projectId: string;
  site: Site;
  points: Awaited<ReturnType<typeof getSitePoints>>;
  visits: Awaited<ReturnType<typeof getVisits>>;
}

/**
 * Pestaña Puntos y lugar (Fase 22): los datos y umbrales del lugar y su
 * catálogo de puntos de control. Hasta la Fase 21 era otra página,
 * `sites/[siteId]`, que ahora redirige aquí.
 */
export function PlaceTab({ projectId, site, points, visits }: PlaceTabProps) {
  // El diálogo de cierre resume cuántas visitas se van a congelar (§ 4.6):
  // cerrar el lugar cierra TODAS sus visitas de una vez.
  const visitsOpen = visits.filter((v) => v.status !== "closed").length;

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

  // En el servidor: formatear la hora con `Intl` en el cliente rompe la
  // hidratación (el ICU de Node y el del navegador difieren).
  const closedLabel =
    site.status === "closed" && site.closed_at
      ? new Intl.DateTimeFormat("es-CO", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "America/Bogota",
        }).format(new Date(site.closed_at))
      : null;

  return (
    <div className="flex flex-col gap-6">
      <SiteForm
        projectId={projectId}
        site={site}
        pointsCount={points.length}
        visitsTotal={visits.length}
        visitsOpen={visitsOpen}
        closedLabel={closedLabel}
      />
      <PointsCatalog
        siteId={site.id}
        points={points}
        disabled={site.status === "closed"}
        hasVisits={visits.length > 0}
        undoBlockers={undoBlockers}
      />
    </div>
  );
}
