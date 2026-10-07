"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { allRows } from "@/lib/supabase/paginate";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { bookRowInputOf, bookRowOf, bookTemplate } from "@/lib/calculations/settlement-book";
import {
  visitsToRewrite,
  type PersistedReading,
} from "@/lib/calculations/settlement-persistence";
import { visitRecordOf, visitSaveOf } from "@/lib/calculations/visit-record";
import { neighborVisitDates, validateVisitCapture } from "@/lib/validators/settlement";
import { bookIssueMessage, validateBook } from "@/lib/validators/settlement-book";
import { hasReadingErrors } from "@/lib/validators/leveling";
import type {
  BenchmarkInput,
  BookRowPayload,
  PointInput,
  SettlementBookReading,
  VisitInput,
} from "@/types/settlement";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import type { Site } from "@/types/site";
import { logDbError } from "@/lib/errors/user-message";
import { resyncSiteReadings } from "@/lib/supabase/settlement-sync";

export interface ActionResult {
  ok: boolean;
  error?: string;
  visitId?: string;
  /**
   * Un punto de control leído en dos armadas (Fase 37, decisión 10): su código
   * y las dos filas, para que la libreta pregunte cuál se elimina.
   */
  duplicate?: { code: string; rows: number[] };
}

/** Lo que pide el popup de nueva visita (Fase 37, decisión 4). */
export interface NewVisitPayload {
  date: string;
  operator: string | null;
  notes: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
}

/** Lo que guarda la visita: su cabecera y su libreta completa (decisión 9). */
export interface VisitPayload extends NewVisitPayload {
  siteId: string;
  visitId: string;
  book: BookRowPayload[];
}

/**
 * Carga el lugar, su catálogo, sus BM y todas sus visitas con lecturas.
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
  // Un lugar de agrupación (Fase 22) no tiene visitas.
  if (!site || site.kind !== "settlement") return null;

  const [{ data: points }, { data: benchmarks }, { data: visits }, { data: readings }] =
    await Promise.all([
      supabase.from("settlement_points").select("*").eq("site_id", siteId),
      supabase.from("site_benchmarks").select("code, elevation, origin_visit_id").eq("site_id", siteId).order("code"),
      // En orden de fecha: el motor y los validadores recorren las visitas así
      // (Fase 26, C-16).
      supabase
        .from("settlement_visits")
        .select("*")
        .eq("site_id", siteId)
        .order("date")
        .order("visit_number"),
      allRows((from, to) =>
        supabase
          .from("settlement_readings")
          .select("*, settlement_visits!inner(site_id)")
          .eq("settlement_visits.site_id", siteId)
          .order("id")
          .range(from, to),
      ),
    ]);

  // Las lecturas ya persistidas de cada visita, por id: tras recalcular, la
  // acción reescribe solo las que cambiaron.
  const persistedReadingsByVisit = new Map<string, Map<string, PersistedReading>>();
  const readingsByVisit = new Map<string, { pointId: string; elevation: number }[]>();
  for (const row of readings ?? []) {
    const r = row as unknown as PersistedReading & { visit_id: string; elevation: string | number };
    const byPoint = persistedReadingsByVisit.get(r.visit_id) ?? new Map();
    byPoint.set(r.point_id, r);
    persistedReadingsByVisit.set(r.visit_id, byPoint);
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
  const benchmarkInputs: BenchmarkInput[] = (benchmarks ?? []).map((b) => ({
    code: b.code,
    elevation: Number(b.elevation),
    originVisitId: b.origin_visit_id,
  }));

  return {
    site: site as Site,
    points: (points ?? []).map(pointInputOf) as PointInput[],
    benchmarks: benchmarkInputs,
    visits: visitInputs,
    persistedReadingsByVisit,
  };
}

/** La libreta guardada de una visita, en el orden de sus filas. */
async function bookOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visitId: string,
): Promise<BookRowPayload[]> {
  const { data } = await supabase
    .from("settlement_book_readings")
    .select("*")
    .eq("visit_id", visitId)
    .order("reading_order");
  return ((data ?? []) as SettlementBookReading[]).map((row) => bookRowOf(row));
}

const readingRow = (r: {
  pointId: string;
  elevation: number;
  partialSettlement: number | null;
  accumulatedSettlement: number | null;
  velocity: number | null;
  alertStatus: string;
}) => ({
  point_id: r.pointId,
  elevation: r.elevation,
  partial_settlement: r.partialSettlement,
  accumulated_settlement: r.accumulatedSettlement,
  velocity: r.velocity,
  alert_status: r.alertStatus,
});

/**
 * Crea una visita con el número siguiente (Fase 37, decisión 4): fecha,
 * nivelador, nota y equipo. Su libreta llega armada como la de la visita
 * anterior —las mismas armadas, sus BM y sus puntos—, sin lecturas; sin
 * anterior, una armada desde el primer BM del lugar con los puntos vigentes.
 */
export async function createVisitAction(
  projectId: string,
  siteId: string,
  input: NewVisitPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const context = await loadContext(supabase, siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };

  const nextNumber =
    context.visits.length === 0 ? 0 : Math.max(...context.visits.map((v) => v.visitNumber)) + 1;
  const previous = context.visits.at(-1) ?? null;

  const issues = validateVisitCapture(
    { id: "nueva", visitNumber: nextNumber, date: input.date, readings: [] },
    context.points,
    previous?.date ?? null,
  );
  if (Object.keys(issues.errors).length > 0) {
    return { ok: false, error: Object.values(issues.errors)[0] };
  }

  const { data, error } = await supabase
    .from("settlement_visits")
    .insert({
      site_id: siteId,
      visit_number: nextNumber,
      date: input.date,
      operator: input.operator,
      notes: input.notes,
      equipment_brand: input.equipmentBrand,
      equipment_model: input.equipmentModel,
      equipment_serial: input.equipmentSerial,
    })
    .select("id")
    .single();
  if (error) {
    // 23505 = unique_violation: dos peticiones a la vez (un doble clic, dos
    // pestañas) calcularon el mismo número; el UNIQUE (site_id, visit_number)
    // es la última defensa.
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe una visita con ese número. Recarga la página e inténtalo de nuevo." };
    }
    return { ok: false, error: logDbError(error, "No se pudo crear la visita.") };
  }

  const template = bookTemplate(
    previous ? await bookOf(supabase, previous.id) : null,
    context.points,
    input.date,
    context.benchmarks,
  );
  if (template.length > 0) {
    const record = visitRecordOf({
      visitId: data.id,
      date: input.date,
      rows: template,
      points: context.points,
      benchmarks: context.benchmarks,
    });
    const { error: bookError } = await supabase.rpc("save_visit", {
      p_visit_id: data.id,
      p_header: { date: input.date, ...record.header },
      p_book: record.rows,
      p_readings: [],
      p_rewrites: [],
    });
    if (bookError) {
      return { ok: false, error: logDbError(bookError, "La visita se creó, pero no su libreta.") };
    }
  }

  // Con `context.site.project_id`, no con el `projectId` del cliente.
  revalidatePath(`/projects/${context.site.project_id}/settlement/${siteId}`);
  return { ok: true, visitId: data.id };
}

/**
 * Guarda una visita: su cabecera y su libreta completa, lectura por lectura
 * (Fase 37, decisión 9). Todo se recalcula aquí —cotas, verificación, estado,
 * histórico— con `visitRecordOf`; lo que el cliente muestre es una vista
 * previa. REVALIDA antes de persistir: una llamada directa a la acción podría
 * intentar guardar lo que la interfaz bloquea.
 */
export async function saveVisitAction(
  projectId: string,
  payload: VisitPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const context = await loadContext(supabase, payload.siteId);
  if (!context) return { ok: false, error: "Lugar no encontrado." };

  const { data: visit } = await supabase
    .from("settlement_visits")
    .select("id, visit_number, site_id")
    .eq("id", payload.visitId)
    .maybeSingle();
  if (!visit || visit.site_id !== payload.siteId) return { ok: false, error: "Visita no encontrada." };

  const check = validateBook(payload.book.map(bookRowInputOf), context.benchmarks);
  if (check.errors.length > 0) return { ok: false, error: check.errors[0] };
  const rowIndex = check.rowIssues.findIndex((i) => Object.keys(i.errors).length > 0);
  if (hasReadingErrors(check.rowIssues) && rowIndex >= 0) {
    const first = Object.values(check.rowIssues[rowIndex]!.errors)[0];
    return { ok: false, error: `Libreta, fila ${rowIndex + 1}: ${first}` };
  }

  const record = visitRecordOf({
    visitId: payload.visitId,
    date: payload.date,
    rows: payload.book,
    points: context.points,
    benchmarks: context.benchmarks,
  });
  const duplicate = record.issues.find((i) => i.kind === "duplicate");
  if (duplicate && duplicate.kind === "duplicate") {
    return {
      ok: false,
      error: bookIssueMessage(duplicate),
      duplicate: { code: duplicate.code, rows: duplicate.rows },
    };
  }

  const others = context.visits.filter((v) => v.id !== payload.visitId);
  const neighbors = neighborVisitDates({ visitNumber: visit.visit_number }, others);
  // Una visita de cotas tecleadas, sin libreta, conserva sus cotas y su
  // cabecera al guardar sus datos (revisión final de la Fase 37).
  const stored = context.visits.find((v) => v.id === payload.visitId)?.readings ?? [];
  const toSave = visitSaveOf(record, payload.book, stored);
  const candidate: VisitInput = {
    id: payload.visitId,
    visitNumber: visit.visit_number,
    date: payload.date,
    readings: toSave.elevations,
  };
  const issues = validateVisitCapture(candidate, context.points, neighbors.previous, neighbors.next);
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

  const history = computeHistory(context.points, [...others, candidate], thresholdsOf(context.site));
  const computed = history.visits.find((v) => v.visitId === payload.visitId);
  if (!computed) return { ok: false, error: "No se pudo calcular la visita." };
  const rewrites = visitsToRewrite({
    recalculated: history.visits,
    persistedByVisit: context.persistedReadingsByVisit,
    skipVisitId: payload.visitId,
  });

  // Todo en una sola transacción (Fase 23): purga, cabecera, libreta, lecturas
  // y propagación.
  const { error } = await supabase.rpc("save_visit", {
    p_visit_id: payload.visitId,
    p_header: {
      date: payload.date,
      operator: payload.operator,
      notes: payload.notes,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      ...toSave.header,
    },
    p_book: record.rows,
    p_readings: computed.readings.map(readingRow),
    p_rewrites: rewrites.flatMap((rewrite) =>
      rewrite.readings.map((r) => ({ visit_id: rewrite.visitId, ...readingRow(r) })),
    ),
  });
  if (error) return { ok: false, error: logDbError(error, "No se pudo guardar la visita.") };

  // La página de la visita también: su cabecera —armadas, verificación, «En
  // medición»— vuelve en la misma respuesta de cada lectura guardada.
  const sitePath = `/projects/${context.site.project_id}/settlement/${payload.siteId}`;
  revalidatePath(sitePath);
  revalidatePath(`${sitePath}/visits/${payload.visitId}`);
  return { ok: true };
}

/**
 * Elimina cualquier visita (Fase 37, decisión 18): sus lecturas y su libreta
 * se van con ella (cascada) y el histórico de las demás se recalcula —el
 * parcial y la velocidad de la siguiente se miden contra la anterior—.
 */
export async function deleteVisitAction(
  projectId: string,
  siteId: string,
  visitId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.project_id !== projectId) return { ok: false, error: "Lugar no encontrado." };

  const { error } = await supabase
    .from("settlement_visits")
    .delete()
    .eq("id", visitId)
    .eq("site_id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar la visita.") };

  const resync = await resyncSiteReadings(supabase, siteId);
  if (!resync.ok) return { ok: false, error: resync.error };

  revalidatePath(`/projects/${projectId}/settlement/${siteId}`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
