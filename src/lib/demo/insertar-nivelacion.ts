// Inserta el proceso de nivelación del proyecto de ejemplo.
//
// Con `computeLeveling` como fuente de la verdad de los resultados
// persistidos, igual que `insertarPoligonal` con `computePolygonal`: el
// proyecto de ejemplo nunca queda desincronizado con lo que produciría
// `saveLevelingProcessAction` en un guardado real. Misma estrategia que el
// `insertLeveling` de `scripts/seed.mjs`.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeLeveling,
  totalDistanceFromReadings,
} from "@/lib/calculations/leveling";
import type { Database } from "@/types/database";
import type { ReadingInput } from "@/types/leveling";
import type { LecturaNivelacionDemo, NivelacionDemo } from "./fixtures";

type Client = SupabaseClient<Database>;

function aReadingInput(r: LecturaNivelacionDemo): ReadingInput {
  return {
    pointCode: r.code,
    pointType: r.type,
    backsight: r.back ?? null,
    foresight: r.fore ?? null,
    backUpperM: r.backUpperM ?? null,
    backLowerM: r.backLowerM ?? null,
    foreUpperM: r.foreUpperM ?? null,
    foreLowerM: r.foreLowerM ?? null,
    backDistanceM: r.backDistanceM ?? null,
    foreDistanceM: r.foreDistanceM ?? null,
    // Derivado por el motor desde las distancias por visual.
    distanceAccumulatedKm: null,
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
): Promise<string> {
  const result = computeLeveling({
    type: nivelacion.type,
    startElevation: nivelacion.startElevation,
    endElevation: nivelacion.endElevation ?? null,
    // El orden lo declara el proceso (Fase 8), no ya el proyecto.
    order: nivelacion.precisionOrder,
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
      // Derivada de las distancias por visual, como en el editor real.
      total_distance_km: totalDistanceFromReadings(
        nivelacion.forward.map(aReadingInput),
      ),
      // Orden y equipo viven en el proceso desde la Fase 8. A un nivel se le
      // pide su tipo y su desviación típica en mm/km (ISO 17123-2), no la
      // precisión angular de una estación total.
      precision_order: nivelacion.precisionOrder,
      equipment_brand: nivelacion.equipmentBrand,
      equipment_model: nivelacion.equipmentModel,
      equipment_serial: nivelacion.equipmentSerial,
      equipment_calibration_date: nivelacion.equipmentCalibrationDate,
      level_type: nivelacion.levelType,
      km_precision_mm: nivelacion.kmPrecisionMm,
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
      back_upper_m: draft.backUpperM ?? null,
      back_lower_m: draft.backLowerM ?? null,
      fore_upper_m: draft.foreUpperM ?? null,
      fore_lower_m: draft.foreLowerM ?? null,
      back_distance_m: r?.backDistanceResolvedM ?? null,
      fore_distance_m: r?.foreDistanceResolvedM ?? null,
      // Derivado por el motor, no por el fixture.
      distance_accumulated_km: r?.distanceAccumulatedKm ?? null,
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
