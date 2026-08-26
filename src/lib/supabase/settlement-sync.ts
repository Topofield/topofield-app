import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  visitsToRewrite,
  type PersistedReading,
} from "@/lib/calculations/settlement-persistence";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import type { PointInput, VisitInput } from "@/types/settlement";

/**
 * Recalcula el histórico de un lugar y reescribe las lecturas de sus visitas
 * ABIERTAS que quedaron obsoletas.
 *
 * Existe porque el `alert_status`, el parcial, el acumulado y la velocidad se
 * **persisten** en `settlement_readings`, y por tanto son una caché derivada
 * de tres entradas: las cotas de las visitas, el catálogo de puntos (C0 y
 * coordenadas) y los umbrales del lugar. Cualquier mutación de esas tres
 * entradas deja la caché obsoleta.
 *
 * `saveVisitAction` ya cubre la primera entrada. Esta función cubre las otras
 * dos, que son las puertas que el cierre de la Fase 5 dejó abiertas:
 *
 *   · editar los umbrales del lugar  → `saveSiteAction`
 *   · editar la C0 o las coordenadas → `savePointAction`
 *
 * Las visitas CERRADAS no se tocan: conservan la clasificación con la que se
 * cerraron, que es lo correcto para la trazabilidad. `visitsToRewrite` decide
 * eso, aquí solo se escribe.
 */
export async function resyncSiteReadings(
  supabase: SupabaseClient,
  siteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };

  const { data: points } = await supabase
    .from("settlement_points")
    .select("*")
    .eq("site_id", siteId);

  const { data: visits } = await supabase
    .from("settlement_visits")
    .select("*")
    .eq("site_id", siteId);

  const { data: readings } = await supabase
    .from("settlement_readings")
    .select("*, settlement_visits!inner(site_id)")
    .eq("settlement_visits.site_id", siteId);

  const statusByVisit = new Map<string, string>();
  for (const v of visits ?? []) statusByVisit.set(v.id, v.status);

  const persistedByVisit = new Map<string, Map<string, PersistedReading>>();
  const readingsByVisit = new Map<
    string,
    { pointId: string; elevation: number }[]
  >();
  for (const row of readings ?? []) {
    const r = row as PersistedReading & {
      visit_id: string;
      elevation: string | number;
    };
    const byPoint = persistedByVisit.get(r.visit_id) ?? new Map();
    byPoint.set(r.point_id, r);
    persistedByVisit.set(r.visit_id, byPoint);

    const list = readingsByVisit.get(r.visit_id) ?? [];
    list.push({ pointId: r.point_id, elevation: Number(r.elevation) });
    readingsByVisit.set(r.visit_id, list);
  }

  const pointInputs: PointInput[] = (points ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    northing: p.northing === null ? null : Number(p.northing),
    easting: p.easting === null ? null : Number(p.easting),
    initialElevation:
      p.initial_elevation === null ? null : Number(p.initial_elevation),
  }));

  const visitInputs: VisitInput[] = (visits ?? []).map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: readingsByVisit.get(v.id) ?? [],
  }));

  const history = computeHistory(pointInputs, visitInputs, thresholdsOf(site));

  const rewrites = visitsToRewrite({
    recalculated: history.visits,
    statusByVisit,
    persistedByVisit,
  });

  for (const rewrite of rewrites) {
    const { error } = await supabase.from("settlement_readings").upsert(
      rewrite.readings.map((r) => ({
        visit_id: rewrite.visitId,
        point_id: r.pointId,
        elevation: r.elevation,
        partial_settlement: r.partialSettlement,
        accumulated_settlement: r.accumulatedSettlement,
        velocity: r.velocity,
        alert_status: r.alertStatus,
      })),
      { onConflict: "visit_id,point_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true };
}
