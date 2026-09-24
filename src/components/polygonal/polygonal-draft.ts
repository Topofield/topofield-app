// Paso de las filas de la base a la entrada del cálculo de poligonal.
//
// Sin «use client»: lo usan el editor (cliente) y el informe imprimible
// (servidor, Fase 13). Antes vivía dentro del editor, y el informe habría
// tenido que reconstruir la entrada con una segunda copia de estas reglas
// —orientación, fila de cierre, promedio de lecturas— que podía divergir del
// editor sin que nada lo notara. Con un solo camino, el dibujo del informe es
// por construcción el mismo que el del editor.

import type { DmsValue } from "@/components/design-system/dms-input";
import { decimalToDms, dmsToDecimal } from "@/lib/calculations/angles";
import { parseNumber } from "@/lib/utils/parse";
import type {
  CorrectionMethod,
  LeastSquaresWeights,
  PolygonalInput,
  PolygonalProcess,
  PolygonalStationWithReadings,
} from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";
import type { PolygonalConfigState } from "./polygonal-config-fields";
import type { StationDraftState } from "./stations-table";

/**
 * Lecturas capturadas de una estación, en grados decimales.
 *
 * Las filas en blanco NO cuentan. El filtro es por `deg` y no por
 * `Number.isFinite`, porque `Number("")` en JavaScript es 0 y no NaN: sin este
 * filtro, las filas vacías con que se rellena hasta el mínimo se leerían como
 * lecturas de 0°0'0" y la dispersión saldría contra el ángulo real.
 * Los minutos y segundos en blanco sí valen 0, que es lo que espera quien
 * teclea un ángulo redondo.
 */
export function readingValues(readings: DmsValue[]): number[] {
  return readings
    .filter((r) => r.deg.trim() !== "")
    .map((r) =>
      dmsToDecimal(Number(r.deg), Number(r.min || 0), Number(r.sec || 0)),
    )
    .filter((v) => Number.isFinite(v));
}

/** Promedio de las lecturas completas, en DMS. `null` si no hay ninguna. */
export function averageOf(readings: DmsValue[]): DmsValue | null {
  const values = readingValues(readings);
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const dms = decimalToDms(avg);
  return { deg: String(dms.deg), min: String(dms.min), sec: String(dms.sec) };
}

export function dmsRow(
  deg: number | null,
  min: number | null,
  sec: number | null,
): DmsValue {
  return {
    deg: deg != null ? String(deg) : "",
    min: min != null ? String(min) : "",
    sec: sec != null ? String(sec) : "",
  };
}

export function processToConfig(p: PolygonalProcess): PolygonalConfigState {
  return {
    name: p.name,
    type: p.type,
    angleType: p.angle_type,
    referencePointId: p.reference_point_id ?? "",
    referencePointCode: p.reference_point_code ?? "",
    hasClosingRow: p.has_closing_row ?? false,
    angleReadingsMin: String(p.angle_readings_min),
    startPointCode: p.start_point_code,
    startNorth: String(p.start_north),
    startEast: String(p.start_east),
    startAzimuth: dmsRow(
      p.start_azimuth_deg,
      p.start_azimuth_min,
      p.start_azimuth_sec,
    ),
    endPointCode: p.end_point_code ?? "",
    endNorth: p.end_north != null ? String(p.end_north) : "",
    endEast: p.end_east != null ? String(p.end_east) : "",
    endAzimuth: dmsRow(p.end_azimuth_deg, p.end_azimuth_min, p.end_azimuth_sec),
    precisionOrder: p.precision_order,
    totalStation: {
      equipmentBrand: p.equipment_brand ?? "",
      equipmentModel: p.equipment_model ?? "",
      equipmentSerial: p.equipment_serial ?? "",
      equipmentCalibrationDate: p.equipment_calibration_date ?? "",
      angularPrecisionSeconds:
        p.angular_precision_seconds != null
          ? String(p.angular_precision_seconds)
          : "",
      distancePrecisionMm:
        p.distance_precision_mm != null ? String(p.distance_precision_mm) : "",
      distancePrecisionPpm:
        p.distance_precision_ppm != null
          ? String(p.distance_precision_ppm)
          : "",
    },
  };
}

/** Pesos del ajuste por mínimos cuadrados como los teclea el usuario (Fase 14). */
export interface LeastSquaresWeightsDraft {
  sigmaAngleSeconds: string;
  sigmaDistanceM: string;
  distanceMeasurements: string;
}

export function weightsToDraft(p: PolygonalProcess): LeastSquaresWeightsDraft {
  return {
    sigmaAngleSeconds:
      p.ls_sigma_angle_seconds != null ? String(p.ls_sigma_angle_seconds) : "",
    sigmaDistanceM:
      p.ls_sigma_distance_m != null ? String(p.ls_sigma_distance_m) : "",
    distanceMeasurements:
      p.ls_distance_measurements != null ? String(p.ls_distance_measurements) : "",
  };
}

/**
 * Los pesos del borrador, o `null` si falta alguno. Sin validar el signo: eso
 * lo decide el motor (que no ajusta con pesos no positivos) y el guardado.
 */
export function weightsFromDraft(
  draft: LeastSquaresWeightsDraft,
): LeastSquaresWeights | null {
  const sigmaAngleSeconds = parseNumber(draft.sigmaAngleSeconds);
  const sigmaDistanceM = parseNumber(draft.sigmaDistanceM);
  const distanceMeasurements = parseNumber(draft.distanceMeasurements);
  return sigmaAngleSeconds != null &&
    sigmaDistanceM != null &&
    distanceMeasurements != null
    ? { sigmaAngleSeconds, sigmaDistanceM, distanceMeasurements }
    : null;
}

export function stationToDraft(
  st: PolygonalStationWithReadings,
  readingsMin: number,
): StationDraftState {
  const stored = (st.polygonal_angle_readings ?? []).map((r) =>
    dmsRow(r.angle_deg, r.angle_min, r.angle_sec),
  );
  // Siempre se muestran al menos `readingsMin` filas: las que falten van
  // vacías, para que el capturador vea cuántas le exige el proceso.
  const readings =
    stored.length >= readingsMin
      ? stored
      : [
          ...stored,
          ...Array.from({ length: readingsMin - stored.length }, () => ({
            deg: "",
            min: "",
            sec: "",
          })),
        ];
  return {
    id: crypto.randomUUID(),
    pointCode: st.point_code,
    angle: dmsRow(st.angle_deg, st.angle_min, st.angle_sec),
    readings,
    deflectionDirection: st.deflection_direction,
    distance:
      st.horizontal_distance != null ? String(st.horizontal_distance) : "",
  };
}

export function dmsToDecimalOrNaN(value: DmsValue): number {
  const deg = parseNumber(value.deg);
  const min = parseNumber(value.min);
  const sec = parseNumber(value.sec);
  return deg != null && min != null && sec != null
    ? dmsToDecimal(deg, min, sec)
    : Number.NaN;
}

export function buildInput(
  config: PolygonalConfigState,
  stations: StationDraftState[],
  method: CorrectionMethod,
  order: PrecisionOrder,
  leastSquares: LeastSquaresWeights | null = null,
): PolygonalInput {
  const controlled = config.type === "open_controlled";
  return {
    type: config.type,
    startNorth: parseNumber(config.startNorth) ?? Number.NaN,
    startEast: parseNumber(config.startEast) ?? Number.NaN,
    startAzimuth: dmsToDecimalOrNaN(config.startAzimuth),
    endNorth: controlled ? parseNumber(config.endNorth) : null,
    endEast: controlled ? parseNumber(config.endEast) : null,
    endAzimuth:
      controlled && config.endAzimuth.deg.trim() !== ""
        ? dmsToDecimalOrNaN(config.endAzimuth)
        : null,
    order,
    method,
    angleType: config.angleType === "" ? "interior" : config.angleType,
    hasOrientation:
      config.referencePointId !== "" || config.referencePointCode !== "",
    hasClosingRow: config.hasClosingRow,
    leastSquares,
    stations: stations.map((st) => ({
      pointCode: st.pointCode,
      angle: dmsToDecimalOrNaN(averageOf(st.readings) ?? st.angle),
      deflectionDirection: st.deflectionDirection,
      distance: parseNumber(st.distance),
      readings: readingValues(st.readings).map((angle, i) => ({
        order: i + 1,
        angle,
      })),
    })),
  };
}

/** La entrada del cálculo directamente desde las filas de un proceso. */
export function polygonalInputOf(
  process: PolygonalProcess,
  stations: PolygonalStationWithReadings[],
): PolygonalInput {
  const config = processToConfig(process);
  return buildInput(
    config,
    stations.map((st) => stationToDraft(st, process.angle_readings_min)),
    process.correction_method ?? "bowditch",
    process.precision_order,
    weightsFromDraft(weightsToDraft(process)),
  );
}
