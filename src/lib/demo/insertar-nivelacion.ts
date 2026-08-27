// Inserta el proceso de nivelación del proyecto de ejemplo.
//
// Con `computeLeveling` como fuente de la verdad de los resultados
// persistidos, igual que `insertarPoligonal` con `computePolygonal`: el
// proyecto de ejemplo nunca queda desincronizado con lo que produciría
// `saveLevelingProcessAction` en un guardado real. Misma estrategia que el
// `insertLeveling` de `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLeveling } from "@/lib/calculations/leveling";
import type { Database } from "@/types/database";
import type { ReadingInput } from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";
import type { LecturaNivelacionDemo, NivelacionDemo } from "./fixtures";

type Client = SupabaseClient<Database>;

function aReadingInput(r: LecturaNivelacionDemo): ReadingInput {
  return {
    pointCode: r.code,
    pointType: r.type,
    backsight: r.back ?? null,
    foresight: r.fore ?? null,
    distanceM: r.distanceM ?? null,
    distanceAccumulatedKm: r.distanceAccumKm ?? null,
  };
}

/**
 * Inserta la nivelación, sus lecturas, y la cierra en diferido.
 *
 * Nace `calculated` y se cierra al final (no de entrada) porque los triggers
 * de inmutabilidad rechazan escribir lecturas bajo un proceso ya cerrado —
 * mismo motivo que en `insertarPoligonal`. El demo la deja cerrada para que
 * alimente el informe de nivelación. Devuelve el `id` del proceso creado.
 */
export async function insertarNivelacion(
  supabase: Client,
  projectId: string,
  siteId: string,
  userId: string,
  nivelacion: NivelacionDemo,
  order: PrecisionOrder,
): Promise<string> {
  const result = computeLeveling({
    type: nivelacion.type,
    startElevation: nivelacion.startElevation,
    endElevation: nivelacion.endElevation ?? null,
    order,
    totalDistanceKm: nivelacion.totalDistanceKm,
    forward: nivelacion.forward.map(aReadingInput),
    return: nivelacion.return ? nivelacion.return.map(aReadingInput) : null,
  });

  const { data: proc, error } = await supabase
    .from("leveling_processes")
    .insert({
      project_id: projectId,
      site_id: siteId,
      name: nivelacion.name,
      type: nivelacion.type,
      start_bm_code: nivelacion.startBmCode,
      start_bm_elevation: nivelacion.startElevation,
      end_bm_code: nivelacion.endBmCode ?? null,
      end_bm_elevation: nivelacion.endElevation ?? null,
      has_return_run: nivelacion.return != null,
      total_distance_km: nivelacion.totalDistanceKm,
      status: "calculated",
      closure_error_mm: result.closureErrorMm,
      tolerance_mm: result.toleranceMm,
      meets_tolerance: result.meetsTolerance,
      forward_error_mm: result.forward.errorMm,
      return_error_mm: result.return?.errorMm ?? null,
      discrepancy_mm: result.discrepancyMm,
      notes: nivelacion.notes,
    })
    .select("id")
    .single();

  if (error) throw error;

  const filas = nivelacion.forward.map((draft, i) => {
    const r = result.forward.readings[i];
    return {
      process_id: proc.id,
      run_type: "forward" as const,
      reading_order: i + 1,
      point_code: draft.code,
      point_type: draft.type,
      backsight: draft.back ?? null,
      foresight: draft.fore ?? null,
      distance_m: draft.distanceM ?? null,
      distance_accumulated_km: draft.distanceAccumKm ?? null,
      instrument_height: r?.instrumentHeight ?? null,
      elevation_calculated: r?.elevationCalculated ?? null,
      elevation_corrected: r?.elevationCorrected ?? null,
      correction_applied: r?.correctionApplied ?? null,
    };
  });

  const { error: errFilas } = await supabase
    .from("leveling_readings")
    .insert(filas);
  if (errFilas) throw errFilas;

  const { error: errCierre } = await supabase
    .from("leveling_processes")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by: userId,
    })
    .eq("id", proc.id);
  if (errCierre) throw errCierre;

  return proc.id;
}
