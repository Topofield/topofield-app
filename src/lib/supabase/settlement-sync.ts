import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { bookRowOf } from "@/lib/calculations/settlement-book";
import {
  visitsToRewrite,
  type PersistedReading,
} from "@/lib/calculations/settlement-persistence";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { recalculateSite } from "@/lib/calculations/visit-record";
import type { BookRowPayload, PointInput, VisitInput } from "@/types/settlement";
import { logDbError } from "@/lib/errors/user-message";
import { allRows } from "./paginate";

/**
 * Recalcula el histórico de un lugar y reescribe las lecturas de sus visitas
 * que quedaron obsoletas.
 *
 * Existe porque el `alert_status`, el parcial, el acumulado y la velocidad se
 * **persisten** en `settlement_readings`, y por tanto son una caché derivada
 * de tres entradas: las cotas de las visitas, la C0 de cada punto del catálogo
 * y los umbrales del lugar. Cualquier mutación de esas tres
 * entradas deja la caché obsoleta.
 *
 * `saveVisitAction` ya cubre la primera entrada. Esta función cubre las otras
 * dos, que son las puertas que el cierre de la Fase 5 dejó abiertas:
 *
 *   · editar los umbrales del lugar  → `saveSiteAction`
 *   · editar la C0                   → `savePointAction`
 *
 * Desde la Fase 37 ninguna visita se cierra: todas se reescriben si cambian.
 *
 * `dryRun` no escribe: solo cuenta cuántas lecturas se reescribirían. Lo usa
 * `scripts/resincronizar-asentamientos.mjs` para simular antes de aplicar el
 * cambio de línea base de la Fase 11.
 */
export async function resyncSiteReadings(
  supabase: SupabaseClient,
  siteId: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<{ ok: true; rewritten: number } | { ok: false; error: string }> {
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

  const { data: readings } = await allRows((from, to) =>
    supabase
      .from("settlement_readings")
      .select("*, settlement_visits!inner(site_id)")
      .eq("settlement_visits.site_id", siteId)
      .order("id")
      .range(from, to),
  );


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

  const pointInputs: PointInput[] = (points ?? []).map(pointInputOf);

  const visitInputs: VisitInput[] = (visits ?? []).map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: readingsByVisit.get(v.id) ?? [],
  }));

  const history = computeHistory(pointInputs, visitInputs, thresholdsOf(site));

  const rewrites = visitsToRewrite({
    recalculated: history.visits,
    persistedByVisit,
  });

  const rewritten = rewrites.reduce((n, r) => n + r.readings.length, 0);
  if (dryRun) return { ok: true, rewritten };

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
    if (error) return { ok: false, error: logDbError(error, "No se pudieron recalcular las lecturas del lugar.") };
  }

  return { ok: true, rewritten };
}

/**
 * Recalcula TODAS las visitas de un lugar desde su libreta, con los BM del
 * lugar y sin compensar (Fase 37), y las guarda. Lo usan el cambio de la cota
 * de un BM (decisión 13) y el script de resincronización del despliegue, que
 * pasa a la regla nueva las visitas que se guardaron compensadas.
 *
 * Una visita por llamada a `save_visit`: cada una es atómica; si una falla, el
 * error dice cuál y las anteriores quedan recalculadas, que es correcto.
 *
 * `dryRun` no escribe: cuenta las visitas y las lecturas cuya cota cambia
 * (`changedVisits`, `changedReadings`); `visits` es el total del lugar.
 */
export async function recomputeSite(
  supabase: SupabaseClient,
  siteId: string,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<
  { ok: true; visits: number; changedVisits: number; changedReadings: number } | { ok: false; error: string }
> {
  const { data: site } = await supabase.from("sites").select("*").eq("id", siteId).maybeSingle();
  if (!site) return { ok: false, error: "Lugar no encontrado." };

  // Un error de lectura no puede pasar por un lugar sin cambios: sin
  // `site_benchmarks` (antes del paso 1 del despliegue) no habría BM y todo
  // saldría «al día».
  const fail = (error: { message: string; code?: string }) => ({
    ok: false as const,
    error: logDbError(error, "No se pudo leer el lugar para recalcularlo."),
  });
  const [pointsRes, benchmarksRes, visitsRes] = await Promise.all([
    supabase.from("settlement_points").select("*").eq("site_id", siteId),
    supabase.from("site_benchmarks").select("code, elevation, origin_visit_id").eq("site_id", siteId),
    supabase.from("settlement_visits").select("id, visit_number, date").eq("site_id", siteId).order("date"),
  ]);
  for (const r of [pointsRes, benchmarksRes, visitsRes]) if (r.error) return fail(r.error);
  const { data: points } = pointsRes;
  const { data: benchmarks } = benchmarksRes;
  const { data: visits } = visitsRes;
  const visitIds = (visits ?? []).map((v) => v.id);
  const [bookRes, storedRes] = await Promise.all([
    allRows((from, to) =>
      supabase
        .from("settlement_book_readings")
        .select("*")
        .in("visit_id", visitIds)
        .order("visit_id")
        .order("reading_order")
        .range(from, to),
    ),
    allRows((from, to) =>
      supabase
        .from("settlement_readings")
        .select("visit_id, point_id, elevation")
        .in("visit_id", visitIds)
        .order("visit_id")
        .order("point_id")
        .range(from, to),
    ),
  ]);
  for (const r of [bookRes, storedRes]) if (r.error) return fail(r.error);
  const { data: bookRows } = bookRes;
  const { data: stored } = storedRes;

  const storedByVisit = new Map<string, { pointId: string; elevation: number }[]>();
  for (const r of stored ?? []) {
    const list = storedByVisit.get(r.visit_id) ?? [];
    list.push({ pointId: r.point_id, elevation: Number(r.elevation) });
    storedByVisit.set(r.visit_id, list);
  }
  const rowsByVisit = new Map<string, BookRowPayload[]>();
  for (const row of bookRows ?? []) {
    const list = rowsByVisit.get(row.visit_id) ?? [];
    list.push(bookRowOf(row));
    rowsByVisit.set(row.visit_id, list);
  }
  const results = recalculateSite({
    points: (points ?? []).map(pointInputOf),
    benchmarks: (benchmarks ?? []).map((b) => ({
      code: b.code,
      elevation: Number(b.elevation),
      originVisitId: b.origin_visit_id,
    })),
    thresholds: thresholdsOf(site),
    visits: (visits ?? []).map((v) => ({
      id: v.id,
      visitNumber: v.visit_number,
      date: v.date,
      rows: rowsByVisit.get(v.id) ?? [],
      elevations: storedByVisit.get(v.id) ?? [],
    })),
  });

  const storedElevation = new Map(
    (stored ?? []).map((r) => [`${r.visit_id}:${r.point_id}`, Number(r.elevation)]),
  );
  // Lo que cambia en una visita con libreta: las cotas recalculadas que no son
  // las guardadas, y las guardadas que ya no salen de la libreta, que
  // `save_visit` purgaría.
  const changedPerVisit = results.map(({ visitId, readings }) => {
    if (!rowsByVisit.has(visitId)) return 0;
    const changed = readings.filter((r) => {
      const before = storedElevation.get(`${visitId}:${r.pointId}`);
      return before == null || Math.abs(before - r.elevation) > 0.00005;
    }).length;
    const computed = new Set(readings.map((r) => r.pointId));
    const purged = (storedByVisit.get(visitId) ?? []).filter((r) => !computed.has(r.pointId)).length;
    return changed + purged;
  });
  const changedReadings = changedPerVisit.reduce((a, b) => a + b, 0);
  const changedVisits = changedPerVisit.filter((n) => n > 0).length;
  if (dryRun) return { ok: true, visits: results.length, changedVisits, changedReadings };

  for (const { visitId, record, readings } of results) {
    // Una visita sin libreta —de cotas tecleadas, anterior a la Fase 37—
    // conserva sus cotas, su cabecera y su libreta vacía; se guardan sus
    // lecturas, cuyo parcial y velocidad dependen de las vecinas. Una sin
    // libreta ni lecturas no tiene nada que guardar.
    const hasBook = rowsByVisit.has(visitId);
    if (!hasBook && readings.length === 0) continue;
    const { error } = await supabase.rpc("save_visit", {
      p_visit_id: visitId,
      p_header: hasBook ? record.header : {},
      p_book: hasBook ? record.rows : [],
      p_readings: readings.map((r) => ({
        point_id: r.pointId,
        elevation: r.elevation,
        partial_settlement: r.partialSettlement,
        accumulated_settlement: r.accumulatedSettlement,
        velocity: r.velocity,
        alert_status: r.alertStatus,
      })),
      p_rewrites: [],
    });
    if (error) {
      return { ok: false, error: logDbError(error, "No se pudo recalcular una visita del lugar.") };
    }
  }
  return { ok: true, visits: results.length, changedVisits, changedReadings };
}
