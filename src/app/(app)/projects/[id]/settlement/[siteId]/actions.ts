"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  validateVisitCapture,
  validateVisitClose,
} from "@/lib/validators/settlement";
import type {
  PointInput,
  Thresholds,
  VisitInput,
} from "@/types/settlement";
import type { Site } from "@/types/site";

export interface ActionResult {
  ok: boolean;
  error?: string;
  visitId?: string;
}

export interface VisitPayload {
  siteId: string;
  visitId: string;
  date: string;
  operator: string | null;
  equipment: string | null;
  weatherConditions: string | null;
  closureErrorMm: number | null;
  notes: string | null;
  readings: { pointId: string; elevation: number }[];
}

/** Umbrales del lugar, desnormalizados para el motor de cálculo. */
function thresholdsOf(site: Site): Thresholds {
  return {
    velocityCaution: Number(site.velocity_caution),
    velocityAlert: Number(site.velocity_alert),
    velocityAlarm: Number(site.velocity_alarm),
    accumulatedCaution: Number(site.accumulated_caution),
    accumulatedAlert: Number(site.accumulated_alert),
    accumulatedAlarm: Number(site.accumulated_alarm),
    angularDistortionLimit: site.angular_distortion_limit,
  };
}

/**
 * Carga el lugar, su catálogo y todas sus visitas con lecturas.
 *
 * El histórico completo es necesario aunque solo se guarde una visita: el
 * asentamiento parcial y la velocidad de un punto dependen de la visita
 * anterior, y la clasificación de alerta depende del acumulado desde C0.
 */
async function loadContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;

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

  const pointInputs: PointInput[] = (points ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    northing: p.northing === null ? null : Number(p.northing),
    easting: p.easting === null ? null : Number(p.easting),
    initialElevation:
      p.initial_elevation === null ? null : Number(p.initial_elevation),
  }));

  const readingsByVisit = new Map<string, { pointId: string; elevation: number }[]>();
  for (const row of readings ?? []) {
    const r = row as unknown as {
      visit_id: string;
      point_id: string;
      elevation: string | number;
    };
    const list = readingsByVisit.get(r.visit_id) ?? [];
    list.push({ pointId: r.point_id, elevation: Number(r.elevation) });
    readingsByVisit.set(r.visit_id, list);
  }

  const visitInputs: VisitInput[] = (visits ?? []).map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: readingsByVisit.get(v.id) ?? [],
  }));

  return { site: site as Site, points: pointInputs, visits: visitInputs };
}

/** Crea una visita con el número siguiente y la fecha dada. */
export async function createVisitAction(
  projectId: string,
  siteId: string,
  date: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const context = await loadContext(supabase, siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };
  if (context.site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite visitas nuevas." };
  }

  const nextNumber =
    context.visits.length === 0
      ? 0
      : Math.max(...context.visits.map((v) => v.visitNumber)) + 1;

  const previous = [...context.visits].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const previousDate = previous.at(-1)?.date ?? null;

  const issues = validateVisitCapture(
    { id: "nueva", visitNumber: nextNumber, date, readings: [] },
    context.points,
    previousDate,
  );
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }

  const { data, error } = await supabase
    .from("settlement_visits")
    .insert({ site_id: siteId, visit_number: nextNumber, date })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Se revalida con `context.site.project_id` (leído del lugar) y no con el
  // `projectId` recibido como parámetro: el mismo criterio que en
  // sites/actions.ts, para no confiar en un id que el cliente podría enviar
  // sin relación con el lugar real.
  revalidatePath(`/projects/${context.site.project_id}/settlement/${siteId}`);
  return { ok: true, visitId: data.id };
}

/**
 * Guarda una visita: su cabecera y sus lecturas, con los resultados
 * recalculados en el servidor.
 *
 * REVALIDA la captura antes de persistir (decisión #10). La clave publicable de
 * Supabase es pública por diseño, así que una llamada directa a esta acción
 * podría intentar guardar una visita que la interfaz habría bloqueado. Los
 * módulos de poligonal y nivelación nacieron sin esta comprobación y la
 * arrastraron como deuda; este nace con ella.
 */
export async function saveVisitAction(
  projectId: string,
  payload: VisitPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  const context = await loadContext(supabase, payload.siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };
  if (context.site.status === "closed") {
    return { ok: false, error: "El lugar está cerrado; no admite cambios." };
  }

  const { data: visit } = await supabase
    .from("settlement_visits")
    .select("id, status, visit_number")
    .eq("id", payload.visitId)
    .maybeSingle();
  if (!visit) return { ok: false, error: "Visita no encontrada." };
  if (visit.status === "closed") {
    return { ok: false, error: "La visita está cerrada; no admite cambios." };
  }

  // --- Revalidación en el servidor -----------------------------------------
  const others = context.visits
    .filter((v) => v.id !== payload.visitId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const previousDate =
    others.filter((v) => v.date < payload.date).at(-1)?.date ?? null;

  const candidate: VisitInput = {
    id: payload.visitId,
    visitNumber: visit.visit_number,
    date: payload.date,
    readings: payload.readings,
  };

  const issues = validateVisitCapture(candidate, context.points, previousDate);
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }
  for (const [pointId, cellIssues] of Object.entries(issues.readingIssues)) {
    const first = Object.values(cellIssues.errors)[0];
    if (first) {
      const code = context.points.find((p) => p.id === pointId)?.code ?? pointId;
      return { ok: false, error: `${code}: ${first}` };
    }
  }

  // --- Recálculo autoritativo ----------------------------------------------
  const merged = [...others, candidate];
  const history = computeHistory(
    context.points,
    merged,
    thresholdsOf(context.site),
  );
  const computed = history.visits.find((v) => v.visitId === payload.visitId);
  if (!computed) return { ok: false, error: "No se pudo calcular la visita." };

  const { error: headerError } = await supabase
    .from("settlement_visits")
    .update({
      date: payload.date,
      operator: payload.operator,
      equipment: payload.equipment,
      weather_conditions: payload.weatherConditions,
      closure_error_mm: payload.closureErrorMm,
      notes: payload.notes,
      status: payload.readings.length > 0 ? "calculated" : "draft",
    })
    .eq("id", payload.visitId);
  if (headerError) return { ok: false, error: headerError.message };

  // Las lecturas se reemplazan en bloque: es más simple y más seguro que
  // reconciliar altas, bajas y modificaciones fila a fila.
  const { error: deleteError } = await supabase
    .from("settlement_readings")
    .delete()
    .eq("visit_id", payload.visitId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (computed.readings.length > 0) {
    const { error: insertError } = await supabase
      .from("settlement_readings")
      .insert(
        computed.readings.map((r) => ({
          visit_id: payload.visitId,
          point_id: r.pointId,
          elevation: r.elevation,
          partial_settlement: r.partialSettlement,
          accumulated_settlement: r.accumulatedSettlement,
          velocity: r.velocity,
          alert_status: r.alertStatus,
        })),
      );
    if (insertError) return { ok: false, error: insertError.message };
  }

  // Igual criterio: `context.site.project_id`, no el `projectId` del parámetro.
  revalidatePath(`/projects/${context.site.project_id}/settlement/${payload.siteId}`);
  return { ok: true };
}

/**
 * Cierra una visita: queda inmutable, con responsable y timestamp (§ 4.6).
 *
 * Exige que todos los puntos del catálogo tengan lectura. NO evalúa los
 * umbrales: una visita con puntos en alarma se cierra con normalidad, porque
 * ese es justo el hallazgo que el monitoreo documenta.
 */
export async function closeVisitAction(
  projectId: string,
  siteId: string,
  visitId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const context = await loadContext(supabase, siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };

  const visit = context.visits.find((v) => v.id === visitId);
  if (!visit) return { ok: false, error: "Visita no encontrada." };

  // La fecha de la visita cronológicamente anterior a esta. El cierre también
  // comprueba el orden: sellar como inmutable una visita fechada fuera de orden
  // dejaría un intervalo negativo imposible de corregir después.
  const previousDate =
    context.visits
      .filter((v) => v.id !== visitId && v.date < visit.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1)?.date ?? null;

  const issues = validateVisitClose(visit, context.points, previousDate);
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }

  const { error } = await supabase
    .from("settlement_visits")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", visitId);

  if (error) return { ok: false, error: error.message };

  // Igual criterio: `context.site.project_id`, no el `projectId` del parámetro.
  revalidatePath(`/projects/${context.site.project_id}/settlement/${siteId}`);
  return { ok: true };
}
