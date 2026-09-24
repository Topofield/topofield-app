"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  azimuthFromCoordinates,
  decimalToDms,
  dmsToDecimal,
} from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import {
  canPersistAngleFormat,
  expectStationCapture,
  validateLeastSquaresWeights,
  hasCaptureErrors,
  validatePolygonalStation,
} from "@/lib/validators/polygonal";
import { derivePolygonalCloseStatus } from "./close-status";
import {
  planGeoreference,
  type ControlPoint,
} from "@/components/polygonal/georeference-plan";
import { getPolygonalProcess, getPolygonalStations } from "@/lib/supabase/queries";
import {
  ANGLE_INPUT_FORMATS,
  type AngleInputFormat,
  type AngleType,
  type CorrectionMethod,
  type DeflectionDirection,
  type PolygonalInput,
  type PolygonalType,
} from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/** Una lectura del ángulo tal como la manda el editor. */
export interface ReadingDraft {
  deg: number;
  min: number;
  sec: number;
}

export interface StationDraft {
  pointCode: string;
  /**
   * Promedio de las lecturas. Lo recalcula el servidor desde `readings`
   * cuando las hay: el promedio es derivado, no un dato que el cliente pueda
   * contradecir.
   */
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  readings: ReadingDraft[];
  deflectionDirection: DeflectionDirection | null;
  horizontalDistance: number | null;
}

export interface SavePolygonalPayload {
  processId: string;
  name: string;
  type: PolygonalType;
  startPointCode: string;
  startNorth: number;
  startEast: number;
  startAzimuthDeg: number | null;
  startAzimuthMin: number | null;
  startAzimuthSec: number | null;
  endPointCode: string | null;
  endNorth: number | null;
  endEast: number | null;
  endAzimuthDeg: number | null;
  endAzimuthMin: number | null;
  endAzimuthSec: number | null;
  correctionMethod: CorrectionMethod;
  angleType: AngleType;
  referencePointId: string | null;
  referencePointCode: string | null;
  angleReadingsMin: number;
  hasClosingRow: boolean;
  notes: string | null;
  stations: StationDraft[];
  /** Orden de precisión y equipo (estación total, ISO 17123-3 y -4). */
  precisionOrder: PrecisionOrder;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  equipmentCalibrationDate: string | null;
  angularPrecisionSeconds: number | null;
  distancePrecisionMm: number | null;
  distancePrecisionPpm: number | null;
  /** Pesos del ajuste por mínimos cuadrados (Fase 14); solo con ese método. */
  lsSigmaAngleSeconds: number | null;
  lsSigmaDistanceM: number | null;
  lsDistanceMeasurements: number | null;
}

export interface ClosePolygonalPayload {
  processId: string;
  asRejected: boolean;
}

function angleOrNaN(
  deg: number | null,
  min: number | null,
  sec: number | null,
): number {
  return deg != null && min != null && sec != null
    ? dmsToDecimal(deg, min, sec)
    : Number.NaN;
}

/**
 * Promedio de las lecturas de una estación, en grados decimales. Sin lecturas
 * cae al ángulo que venga en el draft, que es el camino de los datos sin
 * reiteración.
 */
function averageAngle(st: StationDraft): number {
  if (st.readings.length === 0) {
    return angleOrNaN(st.angleDeg, st.angleMin, st.angleSec);
  }
  const total = st.readings.reduce(
    (a, r) => a + dmsToDecimal(r.deg, r.min, r.sec),
    0,
  );
  return total / st.readings.length;
}

function buildInput(payload: SavePolygonalPayload): PolygonalInput {
  return {
    type: payload.type,
    startNorth: payload.startNorth,
    startEast: payload.startEast,
    startAzimuth: angleOrNaN(
      payload.startAzimuthDeg,
      payload.startAzimuthMin,
      payload.startAzimuthSec,
    ),
    endNorth: payload.endNorth,
    endEast: payload.endEast,
    endAzimuth:
      payload.endAzimuthDeg != null
        ? dmsToDecimal(
            payload.endAzimuthDeg,
            payload.endAzimuthMin ?? 0,
            payload.endAzimuthSec ?? 0,
          )
        : null,
    order: payload.precisionOrder,
    method: payload.correctionMethod,
    angleType: payload.angleType,
    // Hay orientación cuando el proceso está amarrado a un punto conocido:
    // entonces startAzimuth apunta del arranque HACIA la referencia y la
    // primera estación lleva el ángulo de orientación.
    hasOrientation:
      payload.referencePointId != null || payload.referencePointCode != null,
    hasClosingRow: payload.hasClosingRow,
    leastSquares:
      payload.lsSigmaAngleSeconds != null &&
      payload.lsSigmaDistanceM != null &&
      payload.lsDistanceMeasurements != null
        ? {
            sigmaAngleSeconds: payload.lsSigmaAngleSeconds,
            sigmaDistanceM: payload.lsSigmaDistanceM,
            distanceMeasurements: payload.lsDistanceMeasurements,
          }
        : null,
    stations: payload.stations.map((st) => ({
      pointCode: st.pointCode,
      angle: averageAngle(st),
      deflectionDirection: st.deflectionDirection,
      distance: st.horizontalDistance,
      readings: st.readings.map((r, i) => ({
        order: i + 1,
        angle: dmsToDecimal(r.deg, r.min, r.sec),
      })),
    })),
  };
}

/**
 * Resuelve el azimut de partida que se persiste.
 *
 * Con punto de amarre del catálogo, se calcula desde sus coordenadas y las del
 * arranque. El valor resuelto se GUARDA en vez de releerse del catálogo al
 * calcular: el CRUD de `reference_points` permite mover un punto ya usado, y el
 * proceso debe conservar el azimut con el que realmente se calculó.
 */
async function resolveStartAzimuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: SavePolygonalPayload,
): Promise<{ deg: number | null; min: number | null; sec: number | null } | { error: string }> {
  if (payload.referencePointId == null) {
    return {
      deg: payload.startAzimuthDeg,
      min: payload.startAzimuthMin,
      sec: payload.startAzimuthSec,
    };
  }

  const { data: refPoint } = await supabase
    .from("reference_points")
    .select("north, east")
    .eq("id", payload.referencePointId)
    .maybeSingle();

  if (refPoint?.north == null || refPoint?.east == null) {
    return { error: "El punto de amarre no tiene coordenadas." };
  }

  const dms = decimalToDms(
    azimuthFromCoordinates(
      payload.startNorth,
      payload.startEast,
      Number(refPoint.north),
      Number(refPoint.east),
    ),
  );
  return dms;
}

/**
 * Guarda la configuración, las estaciones y los resultados de un proceso. El
 * servidor recalcula con computePolygonal para que los resultados persistidos
 * sean autoritativos. Rechaza procesos cerrados (inmutabilidad, § 4.6).
 */
export async function savePolygonalProcessAction(
  payload: SavePolygonalPayload,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado; no admite cambios." };
  }

  // --- Revalidación en el servidor -----------------------------------------
  // La clave publicable de Supabase es pública por diseño: una llamada
  // directa a esta acción podría guardar una libreta que la interfaz habría
  // bloqueado. Antes solo se recalculaban los resultados, de modo que los
  // números eran del servidor pero los datos de campo no se comprobaban.
  // Se usa `expectStationCapture` (la misma regla que el editor) para no
  // bloquear captura parcial legítima: una estación inicial sin ángulo, o
  // una final sin ángulo ni distancia, no es un error (§ 5.1).
  const issues = payload.stations.map((st, i) =>
    validatePolygonalStation(
      {
        pointCode: st.pointCode,
        angleDeg: st.angleDeg,
        angleMin: st.angleMin,
        angleSec: st.angleSec,
        distance: st.horizontalDistance,
      },
      expectStationCapture(payload.type, i, payload.stations.length),
    ),
  );
  if (hasCaptureErrors(issues)) {
    return {
      ok: false,
      error: "Hay celdas con errores de captura; corrígelas antes de guardar.",
    };
  }

  // Pesos del ajuste por mínimos cuadrados (Fase 14): sin ellos el método no
  // produce coordenadas y la base rechazaría el proceso.
  const weightsError = validateLeastSquaresWeights(payload.correctionMethod, payload.type, {
    sigmaAngleSeconds: payload.lsSigmaAngleSeconds,
    sigmaDistanceM: payload.lsSigmaDistanceM,
    distanceMeasurements: payload.lsDistanceMeasurements,
  });
  if (weightsError) return { ok: false, error: weightsError };

  const result = computePolygonal(buildInput(payload));

  const relPrec = result.relativePrecision;
  const relativePrecision =
    relPrec == null
      ? null
      : relPrec === Infinity
        ? "1:∞"
        : `1:${Math.round(relPrec)}`;
  const computed =
    result.stations.length > 0 &&
    result.stations.every((s) => s.north != null);
  const status = computed
    ? "calculated"
    : payload.stations.length > 0
      ? "in_progress"
      : "draft";

  const azimuth = await resolveStartAzimuth(supabase, payload);
  if ("error" in azimuth) return { ok: false, error: azimuth.error };

  const { error: updateError } = await supabase
    .from("polygonal_processes")
    .update({
      name: payload.name,
      type: payload.type,
      angle_type: payload.angleType,
      reference_point_id: payload.referencePointId,
      reference_point_code: payload.referencePointCode,
      angle_readings_min: payload.angleReadingsMin,
      start_point_code: payload.startPointCode,
      start_north: payload.startNorth,
      start_east: payload.startEast,
      start_azimuth_deg: azimuth.deg,
      start_azimuth_min: azimuth.min,
      start_azimuth_sec: azimuth.sec,
      end_point_code: payload.endPointCode,
      end_north: payload.endNorth,
      end_east: payload.endEast,
      end_azimuth_deg: payload.endAzimuthDeg,
      end_azimuth_min: payload.endAzimuthMin,
      end_azimuth_sec: payload.endAzimuthSec,
      correction_method: payload.correctionMethod,
      ls_sigma_angle_seconds: payload.lsSigmaAngleSeconds,
      ls_sigma_distance_m: payload.lsSigmaDistanceM,
      ls_distance_measurements: payload.lsDistanceMeasurements,
      precision_order: payload.precisionOrder,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      equipment_calibration_date: payload.equipmentCalibrationDate,
      angular_precision_seconds: payload.angularPrecisionSeconds,
      distance_precision_mm: payload.distancePrecisionMm,
      distance_precision_ppm: payload.distancePrecisionPpm,
      angular_error_seconds: result.angularError,
      linear_error: result.linearError,
      perimeter: result.perimeter,
      relative_precision: relativePrecision,
      meets_tolerance: result.meetsTolerance,
      notes: payload.notes,
      status,
    })
    .eq("id", payload.processId);
  if (updateError) {
    return { ok: false, error: "No se pudo guardar el proceso." };
  }

  // Las estaciones se reemplazan por completo: borra y reinserta el conjunto.
  await supabase
    .from("polygonal_stations")
    .delete()
    .eq("process_id", payload.processId);

  if (payload.stations.length > 0) {
    const rows = payload.stations.map((st, i) => {
      const r = result.stations[i];
      const azimuth = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
      const corrected =
        r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
      return {
        process_id: payload.processId,
        station_order: i + 1,
        point_code: st.pointCode,
        // El ángulo de la estación es el PROMEDIO de las lecturas, recalculado
        // por el servidor. Las lecturas individuales van a su propia tabla.
        ...(() => {
          const avg = averageAngle(st);
          const dms = Number.isFinite(avg) ? decimalToDms(avg) : null;
          return {
            angle_deg: dms?.deg ?? st.angleDeg,
            angle_min: dms?.min ?? st.angleMin,
            angle_sec: dms?.sec ?? st.angleSec,
          };
        })(),
        deflection_direction: st.deflectionDirection,
        horizontal_distance: st.horizontalDistance,
        corrected_angle_deg: corrected?.deg ?? null,
        corrected_angle_min: corrected?.min ?? null,
        corrected_angle_sec: corrected?.sec ?? null,
        azimuth_deg: azimuth?.deg ?? null,
        azimuth_min: azimuth?.min ?? null,
        azimuth_sec: azimuth?.sec ?? null,
        delta_north: r?.deltaNorth ?? null,
        delta_east: r?.deltaEast ?? null,
        corrected_delta_north: r?.correctedDeltaNorth ?? null,
        corrected_delta_east: r?.correctedDeltaEast ?? null,
        north: r?.north ?? null,
        east: r?.east ?? null,
      };
    });
    const { data: inserted, error: insertError } = await supabase
      .from("polygonal_stations")
      .insert(rows)
      .select("id, station_order");
    if (insertError || !inserted) {
      return { ok: false, error: "No se pudieron guardar las estaciones." };
    }

    // Las lecturas cuelgan de la estación recién insertada. No hace falta
    // borrarlas: las estaciones se reemplazan por completo en cada guardado y
    // las lecturas caen por ON DELETE CASCADE.
    const byOrder = new Map(inserted.map((r) => [r.station_order, r.id]));
    const readingRows = payload.stations.flatMap((st, i) => {
      const stationId = byOrder.get(i + 1);
      if (stationId == null) return [];
      return st.readings.map((r, order) => ({
        station_id: stationId,
        reading_order: order + 1,
        angle_deg: r.deg,
        angle_min: r.min,
        angle_sec: r.sec,
      }));
    });

    if (readingRows.length > 0) {
      const { error: readingsError } = await supabase
        .from("polygonal_angle_readings")
        .insert(readingRows);
      if (readingsError) {
        return { ok: false, error: "No se pudieron guardar las lecturas." };
      }
    }
  }

  revalidatePath(
    `/projects/${process.project_id}/polygonal/${payload.processId}`,
  );
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/**
 * Cierra un proceso (como `closed` o `rejected`) registrando la trazabilidad.
 *
 * El `status` final lo decide el servidor (`derivePolygonalCloseStatus`), no
 * el `asRejected` que manda el cliente: ver el comentario de esa función
 * para el porqué. El diálogo de cierre (`close-process-dialog.tsx`) sigue
 * evaluando `evaluatePolygonalClosure` para la experiencia normal — esto es
 * defensa en profundidad detrás de la UI, no un reemplazo.
 */
export async function closePolygonalProcessAction(
  payload: ClosePolygonalPayload,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id, type, meets_tolerance")
    .eq("id", payload.processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso ya está cerrado." };
  }

  const derived = derivePolygonalCloseStatus(process, payload.asRejected);
  if (!derived.ok) return { ok: false, error: derived.error };

  const { error } = await supabase
    .from("polygonal_processes")
    .update({
      status: derived.status,
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    })
    .eq("id", payload.processId);
  if (error) return { ok: false, error: "No se pudo cerrar el proceso." };

  revalidatePath(
    `/projects/${process.project_id}/polygonal/${payload.processId}`,
  );
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Duplica un proceso: misma configuración, sin estaciones, en borrador. */
export async function duplicatePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("polygonal_processes")
    .select("*")
    .eq("id", processId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Proceso no encontrado." };

  const { error } = await supabase.from("polygonal_processes").insert({
    project_id: original.project_id,
    site_id: original.site_id,
    name: `${original.name} (copia)`,
    type: original.type,
    angle_type: original.angle_type,
    start_point_code: original.start_point_code,
    start_north: original.start_north,
    start_east: original.start_east,
    start_azimuth_deg: original.start_azimuth_deg,
    start_azimuth_min: original.start_azimuth_min,
    start_azimuth_sec: original.start_azimuth_sec,
    end_point_code: original.end_point_code,
    end_north: original.end_north,
    end_east: original.end_east,
    end_azimuth_deg: original.end_azimuth_deg,
    end_azimuth_min: original.end_azimuth_min,
    end_azimuth_sec: original.end_azimuth_sec,
    correction_method: original.correction_method,
    // Los pesos van con el método: sin ellos, el CHECK de la base rechaza un
    // duplicado con mínimos cuadrados (Fase 14). Y el formato de captura de
    // ángulos, que la Fase 13 olvidó copiar.
    ls_sigma_angle_seconds: original.ls_sigma_angle_seconds,
    ls_sigma_distance_m: original.ls_sigma_distance_m,
    ls_distance_measurements: original.ls_distance_measurements,
    angle_input_format: original.angle_input_format,
    precision_order: original.precision_order,
    equipment_brand: original.equipment_brand,
    equipment_model: original.equipment_model,
    equipment_serial: original.equipment_serial,
    equipment_calibration_date: original.equipment_calibration_date,
    angular_precision_seconds: original.angular_precision_seconds,
    distance_precision_mm: original.distance_precision_mm,
    distance_precision_ppm: original.distance_precision_ppm,
    notes: original.notes,
    status: "draft",
  });
  if (error) return { ok: false, error: "No se pudo duplicar el proceso." };

  revalidatePath(`/projects/${original.project_id}`);
  return { ok: true };
}

/** Renombra un proceso. Rechaza los cerrados: son inmutables. */
export async function renamePolygonalProcessAction(
  processId: string,
  name: string,
): Promise<ActionResult> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede modificarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ name: limpio })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo renombrar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Elimina un proceso. Rechaza los cerrados: son inmutables. */
export async function deletePolygonalProcessAction(
  processId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status, project_id")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (process.status === "closed" || process.status === "rejected") {
    return { ok: false, error: "El proceso está cerrado y no puede eliminarse." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .delete()
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo eliminar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/**
 * Guarda en qué formato se teclean los ángulos del proceso (Fase 13, P1). Se
 * llama al conmutar, sin esperar al botón Guardar: así la preferencia no se
 * pierde si el usuario cambia de formato y sale. En un proceso cerrado o
 * rechazado no se guarda (`canPersistAngleFormat`): ahí el conmutador solo
 * cambia la vista.
 */
export async function setAngleInputFormatAction(
  processId: string,
  format: AngleInputFormat,
): Promise<ActionResult> {
  if (!ANGLE_INPUT_FORMATS.includes(format)) {
    return { ok: false, error: "Formato de ángulo no válido." };
  }

  const supabase = await createClient();
  const { data: process } = await supabase
    .from("polygonal_processes")
    .select("id, status")
    .eq("id", processId)
    .maybeSingle();
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  if (!canPersistAngleFormat(process.status)) {
    return { ok: false, error: "El proceso está cerrado: el formato solo cambia la vista." };
  }

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ angle_input_format: format })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo guardar el formato." };
  return { ok: true };
}

/**
 * Georreferencia un proceso con dos de sus estaciones (Fase 15): transforma la
 * entrada, recalcula y reescribe solo las columnas de posición. Vale en
 * cualquier estado, también cerrado: la base admite ahí esas columnas y nada
 * más, así que el veredicto no puede cambiar (PRD, decisión 3).
 *
 * Un proceso no cerrado con cambios sin guardar lo bloquea el editor: aquí se
 * trabaja con lo guardado.
 */
export async function georeferencePolygonalProcessAction(
  processId: string,
  a: ControlPoint,
  b: ControlPoint,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const process = await getPolygonalProcess(supabase, processId);
  if (!process) return { ok: false, error: "Proceso no encontrado." };
  const stations = await getPolygonalStations(supabase, process.id);

  const planned = planGeoreference(process, stations, a, b);
  if (!planned.ok) return planned;
  const { plan } = planned;

  const { error: headerError } = await supabase
    .from("polygonal_processes")
    .update({
      ...plan.header,
      georef_at: new Date().toISOString(),
      georef_by: user.id,
    })
    .eq("id", process.id);
  if (headerError) return { ok: false, error: "No se pudo georreferenciar el proceso." };

  // Una fila por estación: en un cerrado no se puede borrar y reinsertar, como
  // hace el guardado, porque el trigger solo admite UPDATE de posición.
  const results = await Promise.all(
    plan.stations.map(({ id, ...columns }) =>
      supabase.from("polygonal_stations").update(columns).eq("id", id),
    ),
  );
  if (results.some((r) => r.error)) {
    return { ok: false, error: "No se pudieron georreferenciar las estaciones." };
  }

  revalidatePath(`/projects/${process.project_id}/polygonal/${process.id}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
