"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logDbError } from "@/lib/errors/user-message";
import {
  averageReadings,
  decimalToDms,
  dmsToDecimal,
} from "@/lib/calculations/angles";
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import {
  catalogPointOf,
  catalogPointsProblem,
  planCatalogWrites,
  type AmarrePoints,
} from "@/lib/polygonal-amarre";
import {
  validateLeastSquaresWeights,
  hasCaptureErrors,
  polygonalHeaderProblem,
  referenceStartAzimuth,
  stationCaptureIssues,
} from "@/lib/validators/polygonal";
import {
  planGeoreference,
  type ControlPoint,
} from "@/components/polygonal/georeference-plan";
import { getPolygonalProcess, getPolygonalStations } from "@/lib/supabase/queries";
import {
  ANGLE_INPUT_FORMATS,
  type AngleInputFormat,
  type CorrectionMethod,
  type DeflectionDirection,
  type PolygonalInput,
  type PolygonalType,
} from "@/types/polygonal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  referencePointId: string | null;
  referencePointCode: string | null;
  hasClosingRow: boolean;
  notes: string | null;
  stations: StationDraft[];
  /**
   * Datos del alta (Fase 35). Opcionales: una clave que no viaja conserva el
   * valor guardado, porque la función de base parte de la fila actual.
   */
  location?: string | null;
  responsibleName?: string | null;
  responsibleRole?: string | null;
  /** Equipo: solo su identidad (Fase 35, decisión 2). */
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  /** Pesos del ajuste por mínimos cuadrados (Fase 14); solo con ese método. */
  lsSigmaAngleSeconds: number | null;
  lsSigmaDistanceM: number | null;
  lsDistanceMeasurements: number | null;
  /**
   * Los puntos del amarre que van al catálogo del proyecto, solo al guardar el
   * popup del amarre: se escriben con el proceso, en la misma transacción
   * (correcciones de la Fase 35). Con `reference`, la referencia es ese punto.
   */
  catalogPoints?: AmarrePoints;
}

/**
 * Hay orientación cuando el proceso está amarrado a un punto conocido:
 * entonces `startAzimuth` apunta del arranque HACIA la referencia y la primera
 * estación lleva el ángulo de orientación.
 */
function hasOrientationOf(payload: SavePolygonalPayload): boolean {
  return payload.referencePointId != null || payload.referencePointCode != null;
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
 *
 * Es el mismo promedio del editor, redondeado a la décima de segundo que se
 * guarda (Fase 26, C-4): antes el servidor calculaba con el promedio sin
 * redondear, y el error angular guardado no era el que mostraban el editor y
 * el informe.
 */
function averageAngle(st: StationDraft): number {
  if (st.readings.length === 0) {
    return angleOrNaN(st.angleDeg, st.angleMin, st.angleSec);
  }
  return (
    averageReadings(st.readings.map((r) => dmsToDecimal(r.deg, r.min, r.sec))) ??
    Number.NaN
  );
}

function buildInput(payload: SavePolygonalPayload): Omit<PolygonalInput, "order" | "angleType"> {
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
    method: payload.correctionMethod,
    hasOrientation: hasOrientationOf(payload),
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
  projectId: string,
): Promise<{ deg: number | null; min: number | null; sec: number | null } | { error: string }> {
  if (payload.referencePointId == null) {
    return {
      deg: payload.startAzimuthDeg,
      min: payload.startAzimuthMin,
      sec: payload.startAzimuthSec,
    };
  }

  // Del catálogo de ESTE proyecto (Fase 27, PU15): la RLS impide usar el punto
  // de otro usuario, pero no el de otro proyecto del mismo usuario.
  const { data: refPoint } = await supabase
    .from("reference_points")
    .select("north, east")
    .eq("id", payload.referencePointId)
    .eq("project_id", projectId)
    .maybeSingle();

  return referenceStartAzimuth(
    { north: payload.startNorth, east: payload.startEast },
    refPoint ?? null,
  );
}

/**
 * Guarda la configuración, las estaciones y los resultados de un proceso. El
 * servidor recalcula con `computePolygonalDetected` para que los resultados
 * persistidos sean autoritativos, y guarda el orden y el tipo de ángulo
 * detectados (Fase 35). La poligonal no se cierra: siempre admite cambios.
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

  // --- Revalidación en el servidor -----------------------------------------
  // La clave publicable de Supabase es pública por diseño: una llamada
  // directa a esta acción podría guardar una libreta que la interfaz habría
  // bloqueado. Antes solo se recalculaban los resultados, de modo que los
  // números eran del servidor pero los datos de campo no se comprobaban.
  // `stationCaptureIssues` aplica `expectStationCapture` para no bloquear la
  // captura parcial legítima: cada popup guarda, y el punto pendiente o la
  // estación de partida sin amarre no llevan aún ángulo (§ 5.1, Fase 35).
  const headerProblem = polygonalHeaderProblem({
    name: payload.name,
    startPointCode: payload.startPointCode,
    startNorth: payload.startNorth,
    startEast: payload.startEast,
    stationCount: payload.stations.length,
  });
  if (headerProblem) return { ok: false, error: headerProblem };

  // El ángulo de cada estación es el promedio de sus lecturas, como se guarda.
  const issues = stationCaptureIssues(
    payload.type,
    payload.stations,
    payload.hasClosingRow,
    hasOrientationOf(payload),
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

  const { result, order, angleType } = computePolygonalDetected(buildInput(payload));

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

  // Los puntos del amarre van al catálogo con el proceso (correcciones de la
  // Fase 35): aquí se decide qué fila se crea o se corrige, y la función de
  // base las escribe en la misma transacción. Antes, una llamada por punto
  // ANTES de guardar dejaba el catálogo corregido si el guardado fallaba.
  let catalog: ReturnType<typeof planCatalogWrites> = { writes: [], referenceId: null };
  if (payload.catalogPoints) {
    const problem = catalogPointsProblem(payload, payload.catalogPoints);
    if (problem) return { ok: false, error: problem };
    const { data: points, error: readError } = await supabase
      .from("reference_points")
      .select("id, code, north, east")
      .eq("project_id", process.project_id);
    if (readError) return { ok: false, error: logDbError(readError, "No se pudo leer el catálogo.") };
    // Una referencia nueva toma el id que el popup ya puso en el borrador, si es
    // un UUID libre; si no, uno nuevo: un id que ya existe haría fallar el
    // guardado entero sin decir por qué.
    const proposed = payload.referencePointId;
    const usable =
      proposed !== null && UUID.test(proposed) && !(points ?? []).some((p) => p.id === proposed);
    catalog = planCatalogWrites((points ?? []).map(catalogPointOf), payload.catalogPoints, (role) =>
      role === "reference" && usable ? proposed : crypto.randomUUID(),
    );
  }

  // Con la referencia en la carga, el azimut sale de sus coordenadas nuevas: el
  // catálogo aún no las tiene.
  const reference = payload.catalogPoints?.reference ?? null;
  const referencePointId = reference ? catalog.referenceId : payload.referencePointId;
  const azimuth = reference
    ? referenceStartAzimuth({ north: payload.startNorth, east: payload.startEast }, reference)
    : await resolveStartAzimuth(supabase, payload, process.project_id);
  if ("error" in azimuth) return { ok: false, error: azimuth.error };

  // Cabecera, estaciones y lecturas en una sola transacción (Fase 23): si
  // falla un paso no queda nada a medias. Las estaciones se reemplazan por
  // completo; sus lecturas de ángulo viajan anidadas y la base genera los id.
  const stations = payload.stations.map((st, i) => {
    const r = result.stations[i];
    const azimuth = r?.azimuth != null ? decimalToDms(r.azimuth) : null;
    const corrected =
      r?.correctedAngle != null ? decimalToDms(r.correctedAngle) : null;
    return {
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
      readings: st.readings.map((reading, order) => ({
        reading_order: order + 1,
        angle_deg: reading.deg,
        angle_min: reading.min,
        angle_sec: reading.sec,
      })),
    };
  });

  const { error: saveError } = await supabase.rpc("save_polygonal_process", {
    p_process_id: payload.processId,
    p_header: {
      name: payload.name,
      type: payload.type,
      angle_type: angleType,
      reference_point_id: referencePointId,
      reference_point_code: payload.referencePointCode,
      has_closing_row: payload.hasClosingRow,
      ...(payload.location !== undefined && { location: payload.location }),
      ...(payload.responsibleName !== undefined && { responsible_name: payload.responsibleName }),
      ...(payload.responsibleRole !== undefined && { responsible_role: payload.responsibleRole }),
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
      precision_order: order,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      angular_error_seconds: result.angularError,
      linear_error: result.linearError,
      perimeter: result.perimeter,
      relative_precision: relativePrecision,
      // Alcanza al menos el ordinario; sin verificación o sin datos, no se sabe.
      meets_tolerance:
        payload.type === "open_uncontrolled" || result.relativePrecision == null
          ? null
          : order !== null,
      notes: payload.notes,
      status,
    },
    p_stations: stations,
    p_catalog: catalog.writes,
  });
  if (saveError) {
    return { ok: false, error: logDbError(saveError, "No se pudo guardar el proceso.") };
  }

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
    has_closing_row: original.has_closing_row,
    location: original.location,
    responsible_name: original.responsible_name,
    responsible_role: original.responsible_role,
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

/** Renombra un proceso. La poligonal no se cierra (Fase 35). */
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

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ name: limpio })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo renombrar el proceso." };

  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}

/** Elimina un proceso. La poligonal no se cierra (Fase 35). */
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
 * llama al conmutar, sin esperar a ningún guardado: así la preferencia no se
 * pierde si el usuario cambia de formato y sale. Rige la tabla, el ajuste, el
 * informe y los popups (Fase 35).
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

  const { error } = await supabase
    .from("polygonal_processes")
    .update({ angle_input_format: format })
    .eq("id", processId);
  if (error) return { ok: false, error: "No se pudo guardar el formato." };
  return { ok: true };
}

/**
 * Georreferencia un proceso con dos de sus estaciones (Fase 15): transforma la
 * entrada, recalcula y reescribe solo las columnas de posición. Desde la Fase 35
 * la poligonal no se cierra, así que vale siempre; trabaja con lo guardado, y
 * cada popup guarda al confirmar.
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

  // Cabecera y estaciones en una sola transacción (Fase 23). Las estaciones se
  // actualizan por su id, solo en sus columnas de posición: así se diseñó
  // cuando la poligonal se cerraba (Fase 15), y sigue sirviendo.
  const { error } = await supabase.rpc("georeference_polygonal", {
    p_process_id: process.id,
    p_header: {
      ...plan.header,
      georef_at: new Date().toISOString(),
      georef_by: user.id,
    },
    p_stations: plan.stations,
  });
  if (error) {
    return { ok: false, error: logDbError(error, "No se pudo georreferenciar el proceso.") };
  }

  revalidatePath(`/projects/${process.project_id}/polygonal/${process.id}`);
  revalidatePath(`/projects/${process.project_id}`);
  return { ok: true };
}
