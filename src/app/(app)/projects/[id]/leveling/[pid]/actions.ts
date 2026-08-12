"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeLeveling } from "@/lib/calculations/leveling";
import { deriveLevelingCloseStatus } from "./close-status";
import type {
  LevelingInput,
  LevelingType,
  PointType,
  ReadingInput,
} from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface ReadingDraft {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  distanceM: number | null;
  distanceAccumulatedKm: number | null;
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
  totalDistanceKm: number;
  notes: string | null;
  forward: ReadingDraft[];
  return: ReadingDraft[];
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
    distanceM: draft.distanceM,
    distanceAccumulatedKm: draft.distanceAccumulatedKm,
  };
}

function buildInput(
  payload: SaveLevelingPayload,
  order: PrecisionOrder,
): LevelingInput {
  return {
    type: payload.type,
    startElevation: payload.startBmElevation,
    endElevation: payload.type === "link" ? payload.endBmElevation : null,
    order,
    totalDistanceKm: payload.totalDistanceKm,
    forward: payload.forward.map(toReadingInput),
    return: payload.hasReturnRun ? payload.return.map(toReadingInput) : null,
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

  const { data: project } = await supabase
    .from("projects")
    .select("precision_order")
    .eq("id", process.project_id)
    .maybeSingle();
  const order = (project?.precision_order ?? "ordinario") as PrecisionOrder;

  const result = computeLeveling(buildInput(payload, order));

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
      total_distance_km: payload.totalDistanceKm,
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
        distance_m: draft.distanceM,
        distance_accumulated_km: draft.distanceAccumulatedKm,
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
