"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  computeLeveling,
  totalDistanceFromReadings,
} from "@/lib/calculations/leveling";
import { hasReadingErrors, validateRunCapture } from "@/lib/validators/leveling";
import { deriveLevelingCloseStatus } from "./close-status";
import type {
  LevelingInput,
  LevelingType,
  PointType,
  ReadingInput,
} from "@/types/leveling";
import type { LevelType, PrecisionOrder } from "@/types/project";

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
  /** Orden de precisión y equipo (nivel, ISO 17123-2). */
  precisionOrder: PrecisionOrder;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  equipmentCalibrationDate: string | null;
  levelType: LevelType | null;
  kmPrecisionMm: number | null;
}

export interface CloseLevelingPayload {
  processId: string;
  asRejected: boolean;
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

function buildInput(payload: SaveLevelingPayload): LevelingInput {
  return {
    type: payload.type,
    startElevation: payload.startBmElevation,
    endElevation: payload.type === "link" ? payload.endBmElevation : null,
    order: payload.precisionOrder,
    forward: payload.forward.map(toReadingInput),
    return: payload.hasReturnRun ? payload.return.map(toReadingInput) : null,
    // Guardar deja `distances_reconstructed = false` (las distancias pasan a
    // ser las de la libreta), así que se calcula con la regla del acumulado
    // desde el origen (Fase 19), la de un proceso no reconstruido.
    distancesReconstructed: false,
  };
}

/**
 * Guarda la configuración, las lecturas y los resultados de un proceso. El
 * servidor recalcula con computeLeveling para que los resultados persistidos
 * sean autoritativos: no se confía en lo que envía el cliente. Rechaza
 * procesos cerrados (inmutabilidad, § 4.6).
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
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado; no admite cambios." };
  }

  const input = buildInput(payload);

  // --- Revalidación en el servidor -----------------------------------------
  // La clave publicable de Supabase es pública por diseño: una llamada
  // directa a esta acción podría guardar una libreta que la interfaz habría
  // bloqueado. Antes solo se recalculaban los resultados, de modo que los
  // números eran del servidor pero los datos de campo no se comprobaban.
  const forwardIssues = validateRunCapture(
    input.forward,
    input.type,
    payload.precisionOrder,
    false,
  );
  if (hasReadingErrors(forwardIssues)) {
    return {
      ok: false,
      error: "La libreta de ida tiene errores de captura; corrígelos antes de guardar.",
    };
  }
  if (input.return) {
    const returnIssues = validateRunCapture(
      input.return,
      input.type,
      payload.precisionOrder,
      false,
    );
    if (hasReadingErrors(returnIssues)) {
      return {
        ok: false,
        error: "La libreta de vuelta tiene errores de captura; corrígelos antes de guardar.",
      };
    }
  }

  const result = computeLeveling(input);

  // El total se deriva en el servidor, igual que el resto de resultados. Que
  // el cliente lo mandara no lo haría autoritativo: la clave publicable de
  // Supabase es pública por diseño y una llamada directa podría enviar
  // cualquier número. De ese número depende la tolerancia K·√D.
  const totalDistanceKm = totalDistanceFromReadings(input.forward);

  const computed = result.forward.readings.length > 0;
  const status = computed
    ? "calculated"
    : payload.forward.length > 0
      ? "in_progress"
      : "draft";

  const { error: updateError } = await supabase
    .from("leveling_processes")
    .update({
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
      precision_order: payload.precisionOrder,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      equipment_calibration_date: payload.equipmentCalibrationDate,
      level_type: payload.levelType,
      km_precision_mm: payload.kmPrecisionMm,
      closure_error_mm: result.closureErrorMm,
      tolerance_mm: result.toleranceMm,
      meets_tolerance: result.meetsTolerance,
      forward_error_mm: result.forward.errorMm,
      return_error_mm: result.return?.errorMm ?? null,
      discrepancy_mm: result.discrepancyMm,
      notes: payload.notes,
      status,
    })
    .eq("id", payload.processId);
  if (updateError) {
    return { ok: false, error: "No se pudo guardar el proceso." };
  }

  // Las lecturas se reemplazan por completo: borra y reinserta el conjunto.
  await supabase
    .from("leveling_readings")
    .delete()
    .eq("process_id", payload.processId);

  function runRows(
    runType: "forward" | "return",
    drafts: ReadingDraft[],
    computedReadings: typeof result.forward.readings,
  ) {
    return drafts.map((draft, i) => {
      const r = computedReadings[i];
      return {
        process_id: payload.processId,
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

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from("leveling_readings")
      .insert(rows);
    if (insertError) {
      return { ok: false, error: "No se pudieron guardar las lecturas." };
    }
  }

  revalidatePath(`/projects/${process.project_id}/leveling/${payload.processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/**
 * Cierra un proceso (como `closed` o `rejected`) registrando la trazabilidad.
 *
 * El `status` final lo decide el servidor (`deriveLevelingCloseStatus`), no
 * el `asRejected` que manda el cliente: ver el comentario de esa función
 * para el porqué. El diálogo de cierre (`close-process-dialog.tsx`) sigue
 * evaluando `evaluateLevelingClosure` para la experiencia normal — esto es
 * defensa en profundidad detrás de la UI, no un reemplazo.
 */
export async function closeLevelingProcessAction(
  payload: CloseLevelingPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from("leveling_processes")
    .select("id, status, project_id, type, meets_tolerance")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso ya está cerrado." };
  }

  const derived = deriveLevelingCloseStatus(process, payload.asRejected);
  if (!derived.ok) return { ok: false, error: derived.error };

  const { error } = await supabase
    .from("leveling_processes")
    .update({
      status: derived.status,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", payload.processId);
  if (error) return { ok: false, error: "No se pudo cerrar el proceso." };

  revalidatePath(`/projects/${process.project_id}/leveling/${payload.processId}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
