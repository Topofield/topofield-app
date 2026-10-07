"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logDbError } from "@/lib/errors/user-message";
import {
  computeLevelingDetected,
  totalDistanceFromReadings,
} from "@/lib/calculations/leveling";
import { hasReadingErrors, validateRunCapture } from "@/lib/validators/leveling";
import type {
  LevelingInput,
  LevelingType,
  PointType,
  ReadingInput,
} from "@/types/leveling";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ReadingDraft {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  /** Hilos opcionales; el medio es la lectura de mira. */
  backUpperM: number | null;
  backLowerM: number | null;
  foreUpperM: number | null;
  foreLowerM: number | null;
  /** Distancia por visual: la única entrada de la cadena. */
  backDistanceM: number | null;
  foreDistanceM: number | null;
}

export interface SaveLevelingPayload {
  processId: string;
  name: string;
  type: LevelingType;
  startBmCode: string;
  startBmElevation: number;
  endBmCode: string | null;
  endBmElevation: number | null;
  hasReturnRun: boolean;
  notes: string | null;
  forward: ReadingDraft[];
  return: ReadingDraft[];
  /** Los datos del alta (Fase 36). */
  location: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  /**
   * Identidad del nivel (Fase 36): marca, modelo y serie. La calibración, el
   * tipo de nivel y la σ ya no se piden; el guardado no los toca y se
   * conservan los de antes.
   */
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
}

function toReadingInput(draft: ReadingDraft): ReadingInput {
  return {
    pointCode: draft.pointCode,
    pointType: draft.pointType,
    backsight: draft.backsight,
    foresight: draft.foresight,
    backUpperM: draft.backUpperM,
    backLowerM: draft.backLowerM,
    foreUpperM: draft.foreUpperM,
    foreLowerM: draft.foreLowerM,
    backDistanceM: draft.backDistanceM,
    foreDistanceM: draft.foreDistanceM,
    // Derivado por el motor a partir de las distancias por visual; lo que
    // envíe el cliente no se usa.
    distanceAccumulatedKm: null,
  };
}

function buildInput(payload: SaveLevelingPayload): Omit<LevelingInput, "order" | "compensation"> {
  return {
    type: payload.type,
    startElevation: payload.startBmElevation,
    endElevation: payload.type === "link" ? payload.endBmElevation : null,
    forward: payload.forward.map(toReadingInput),
    return: payload.hasReturnRun ? payload.return.map(toReadingInput) : null,
    // Guardar deja `distances_reconstructed = false` (las distancias pasan a
    // ser las de la libreta), así que se calcula con la regla del acumulado
    // desde el origen (Fase 19), la de un proceso no reconstruido.
    distancesReconstructed: false,
  };
}

/**
 * Guarda la cabecera, las lecturas y los resultados de un proceso. El
 * servidor recalcula con `computeLevelingDetected` para que los resultados
 * persistidos sean autoritativos: no se confía en lo que envía el cliente. La
 * nivelación no se cierra desde la Fase 36: siempre se puede guardar.
 */
export async function saveLevelingProcessAction(
  payload: SaveLevelingPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: process } = await supabase
    .from("leveling_processes")
    .select("id, status, project_id")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };

  const input = buildInput(payload);

  // --- Revalidación en el servidor -----------------------------------------
  // La clave publicable de Supabase es pública por diseño: una llamada
  // directa a esta acción podría guardar una libreta que la interfaz habría
  // bloqueado. Antes solo se recalculaban los resultados, de modo que los
  // números eran del servidor pero los datos de campo no se comprobaban.
  // La libreta puede ir a medias: se captura por armada y se guarda tras
  // cada una (Fase 36).
  const forwardIssues = validateRunCapture(input.forward, input.type, { allowUnfinished: true });
  if (hasReadingErrors(forwardIssues)) {
    return {
      ok: false,
      error: "La libreta de ida tiene errores de captura; corrígelos antes de guardar.",
    };
  }
  if (input.return) {
    const returnIssues = validateRunCapture(input.return, input.type, { allowUnfinished: true });
    if (hasReadingErrors(returnIssues)) {
      return {
        ok: false,
        error: "La libreta de vuelta tiene errores de captura; corrígelos antes de guardar.",
      };
    }
  }

  // El orden se detecta y se compensa siempre (Fase 36, decisiones 4 y 5),
  // salvo con la libreta a medias: entonces no hay cierre que guardar.
  const { result, order, verifiable, pending } = computeLevelingDetected(input);
  const closure = pending ? null : result;

  // El total se deriva en el servidor, igual que el resto de resultados. Que
  // el cliente lo mandara no lo haría autoritativo: la clave publicable de
  // Supabase es pública por diseño y una llamada directa podría enviar
  // cualquier número. De ese número depende la tolerancia K·√D.
  const totalDistanceKm = totalDistanceFromReadings(input.forward);

  const status = !pending ? "calculated" : payload.forward.length > 1 ? "in_progress" : "draft";

  function runRows(
    runType: "forward" | "return",
    drafts: ReadingDraft[],
    computedReadings: typeof result.forward.readings,
  ) {
    return drafts.map((draft, i) => {
      const r = computedReadings[i];
      return {
        run_type: runType,
        reading_order: i + 1,
        point_code: draft.pointCode,
        point_type: draft.pointType,
        backsight: draft.backsight,
        foresight: draft.foresight,
        back_upper_m: draft.backUpperM,
        back_lower_m: draft.backLowerM,
        fore_upper_m: draft.foreUpperM,
        fore_lower_m: draft.foreLowerM,
        // Resueltas por el motor: derivadas de los hilos cuando los hay.
        // Persistir la tecleada sola dejaría la celda vacía en un proceso
        // capturado por taquimetría, y el informe lee la fila sin recalcular.
        back_distance_m: r?.backDistanceResolvedM ?? null,
        fore_distance_m: r?.foreDistanceResolvedM ?? null,
        // Derivado: lo escribe el motor, no el borrador del cliente.
        distance_accumulated_km: r?.distanceAccumulatedKm ?? null,
        instrument_height: r?.instrumentHeight ?? null,
        elevation_calculated: r?.elevationCalculated ?? null,
        elevation_corrected: r?.elevationCorrected ?? null,
        correction_applied: r?.correctionApplied ?? null,
      };
    });
  }

  const rows = [
    ...runRows("forward", payload.forward, result.forward.readings),
    ...(payload.hasReturnRun && result.return != null
      ? runRows("return", payload.return, result.return.readings)
      : []),
  ];

  // Cabecera y lecturas en una sola transacción (Fase 23): si falla un paso no
  // queda nada a medias. Las lecturas se reemplazan por completo.
  const { error: saveError } = await supabase.rpc("save_leveling_process", {
    p_process_id: payload.processId,
    p_header: {
      name: payload.name,
      type: payload.type,
      start_bm_code: payload.startBmCode,
      start_bm_elevation: payload.startBmElevation,
      end_bm_code: payload.endBmCode,
      end_bm_elevation: payload.type === "link" ? payload.endBmElevation : null,
      has_return_run: payload.hasReturnRun,
      total_distance_km: totalDistanceKm,
      // Guardar reemplaza la libreta entera, así que las distancias dejan de
      // ser las que inventó el backfill de la Fase 9 repartiendo por mitades.
      // Sin esto el proceso quedaba marcado para siempre: el banner seguiría
      // afirmando que sus distancias son reconstruidas —falso sobre datos ya
      // medidos en campo, en una aplicación cuyo tema es la trazabilidad— y el
      // equilibrado quedaría suprimido justo sobre las distancias reales que
      // sí permiten evaluarlo.
      distances_reconstructed: false,
      precision_order: order,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      location: payload.location,
      responsible_name: payload.responsibleName,
      responsible_role: payload.responsibleRole,
      closure_error_mm: closure?.closureErrorMm ?? null,
      tolerance_mm: closure?.toleranceMm ?? null,
      // El veredicto guardado (Fase 36): alcanza algún orden. Sin con qué
      // juzgar —una abierta sin vuelta—, ninguno.
      meets_tolerance: verifiable ? order !== null : null,
      forward_error_mm: closure?.forward.errorMm ?? null,
      return_error_mm: closure?.return?.errorMm ?? null,
      discrepancy_mm: closure?.discrepancyMm ?? null,
      discrepancy_tolerance_mm:
        closure?.discrepancyToleranceMm == null
          ? null
          : Number(closure.discrepancyToleranceMm.toFixed(1)),
      meets_discrepancy: closure?.meetsDiscrepancy ?? null,
      notes: payload.notes,
      status,
    },
    p_readings: rows,
  });
  if (saveError) {
    return { ok: false, error: logDbError(saveError, "No se pudo guardar el proceso.") };
  }

  revalidatePath(`/projects/${process.project_id}/leveling/${payload.processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/**
 * Duplica una nivelación (Fase 22): misma configuración y equipo, sin
 * lecturas, en borrador. Mismo criterio que la poligonal: una copia con
 * lecturas parecería medida.
 */
export async function duplicateLevelingProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("leveling_processes")
    .select("*")
    .eq("id", processId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase.from("leveling_processes").insert({
    project_id: original.project_id,
    site_id: original.site_id,
    name: `${original.name} (copia)`,
    type: original.type,
    start_bm_code: original.start_bm_code,
    start_bm_elevation: original.start_bm_elevation,
    end_bm_code: original.end_bm_code,
    end_bm_elevation: original.end_bm_elevation,
    has_return_run: original.has_return_run,
    location: original.location,
    responsible_name: original.responsible_name,
    responsible_role: original.responsible_role,
    correction_method: original.correction_method,
    precision_order: original.precision_order,
    equipment_brand: original.equipment_brand,
    equipment_model: original.equipment_model,
    equipment_serial: original.equipment_serial,
    equipment_calibration_date: original.equipment_calibration_date,
    level_type: original.level_type,
    km_precision_mm: original.km_precision_mm,
    notes: original.notes,
    status: "draft",
  });
  if (error) return { ok: false, error: logDbError(error, "No se pudo duplicar el proceso.") };

  revalidatePath(`/projects/${original.project_id}`);
  return { ok: true };
}

/** Renombra una nivelación (Fase 22). */
export async function renameLevelingProcessAction(
  processId: string,
  name: string,
): Promise<ActionResult> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data: process } = await supabase
    .from("leveling_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase
    .from("leveling_processes")
    .update({ name: limpio })
    .eq("id", processId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo renombrar el proceso.") };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Elimina una nivelación con sus lecturas (Fase 22). */
export async function deleteLevelingProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: process } = await supabase
    .from("leveling_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase.from("leveling_processes").delete().eq("id", processId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el proceso.") };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
