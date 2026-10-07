import { PointsCatalog } from "@/components/settlement/points-catalog";
import type { getSitePoints } from "@/lib/supabase/queries";
import type { Site } from "@/types/site";

interface PlaceTabProps {
  site: Site;
  points: Awaited<ReturnType<typeof getSitePoints>>;
  hasVisits: boolean;
}

/**
 * Pestaña Puntos (Fase 22; desde la Fase 37 solo el catálogo, sin el
 * formulario del lugar, que es el popup de «Editar datos»): los puntos de
 * control, libres para darse de alta, editarse y darse de baja.
 */
export function PlaceTab({ site, points, hasVisits }: PlaceTabProps) {
  return <PointsCatalog siteId={site.id} points={points} hasVisits={hasVisits} />;
}
