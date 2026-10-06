// El borrador de una poligonal en la pantalla por pasos (Fase 35) y la carga
// del guardado que sale de él.
//
// Sin «use client»: lo usan la cabecera, el paso de datos y el de ajuste, y la
// prueba. Cada popup cambia una parte del borrador y guarda la carga completa
// con `savePolygonalProcessAction`, que recalcula en el servidor: no hay un
// guardado parcial que pueda dejar la cabecera y las estaciones desparejadas.

import {
  averageReadings,
  azimuthFromCoordinates,
  decimalToDms,
  dmsToDecimal,
} from "@/lib/calculations/angles";
import type { SavePolygonalPayload } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import type {
  CorrectionMethod,
  DeflectionDirection,
  PolygonalInput,
  PolygonalProcess,
  PolygonalStationWithReadings,
  PolygonalType,
} from "@/types/polygonal";

/** Un ángulo en DMS, como se guarda. */
export interface Dms3 {
  deg: number;
  min: number;
  sec: number;
}

export interface StationEdit {
  pointCode: string;
  /** Lecturas del ángulo; vacío si la estación no lleva ángulo. */
  readings: Dms3[];
  deflectionDirection: DeflectionDirection | null;
  distance: number | null;
}

export interface AmarreEdit {
  startCode: string;
  startNorth: number;
  startEast: number;
  /** Punto del catálogo al que se pone 0° atrás. */
  referencePointId: string | null;
  /**
   * El código de la referencia: sin coordenadas, con el azimut tecleado; con
   * `referencePointId`, el del punto del catálogo, para que la poligonal siga
   * orientada si ese punto se borra (la FK pasa a `null`).
   */
  referenceCode: string | null;
  /** Azimut de la estación de partida a la referencia, o el de partida sin amarre. */
  startAzimuth: Dms3 | null;
  endCode: string | null;
  endNorth: number | null;
  endEast: number | null;
  endAzimuth: Dms3 | null;
  hasClosingRow: boolean;
}

export interface DetailsEdit {
  name: string;
  location: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  type: PolygonalType;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
}

export interface PolygonalDraft {
  details: DetailsEdit;
  amarre: AmarreEdit;
  stations: StationEdit[];
  method: CorrectionMethod;
  lsSigmaAngleSeconds: number | null;
  lsSigmaDistanceM: number | null;
  lsDistanceMeasurements: number | null;
  notes: string | null;
}

const num = (v: number | string | null | undefined): number | null =>
  v == null || v === "" ? null : Number(v);

function dms3(
  deg: number | null,
  min: number | null,
  sec: number | string | null,
): Dms3 | null {
  return deg == null ? null : { deg, min: min ?? 0, sec: Number(sec ?? 0) };
}

/** El borrador de un proceso tal como está guardado. */
export function draftOf(
  process: PolygonalProcess,
  stations: PolygonalStationWithReadings[],
): PolygonalDraft {
  return {
    details: {
      name: process.name,
      location: process.location,
      responsibleName: process.responsible_name,
      responsibleRole: process.responsible_role,
      type: process.type,
      equipmentBrand: process.equipment_brand,
      equipmentModel: process.equipment_model,
      equipmentSerial: process.equipment_serial,
    },
    amarre: {
      startCode: process.start_point_code,
      startNorth: Number(process.start_north),
      startEast: Number(process.start_east),
      referencePointId: process.reference_point_id,
      referenceCode: process.reference_point_code,
      startAzimuth: dms3(process.start_azimuth_deg, process.start_azimuth_min, process.start_azimuth_sec),
      endCode: process.end_point_code,
      endNorth: num(process.end_north),
      endEast: num(process.end_east),
      endAzimuth: dms3(process.end_azimuth_deg, process.end_azimuth_min, process.end_azimuth_sec),
      hasClosingRow: process.has_closing_row,
    },
    stations: stations.map((st) => {
      const stored = (st.polygonal_angle_readings ?? []).map((r) => ({
        deg: r.angle_deg,
        min: r.angle_min,
        sec: Number(r.angle_sec),
      }));
      // Datos sin lecturas individuales (anteriores a la Fase 7): el ángulo de
      // la estación es su única lectura.
      const legacy = dms3(st.angle_deg, st.angle_min, st.angle_sec);
      return {
        pointCode: st.point_code,
        readings: stored.length > 0 ? stored : legacy ? [legacy] : [],
        deflectionDirection: st.deflection_direction,
        distance: num(st.horizontal_distance),
      };
    }),
    method: process.correction_method ?? "bowditch",
    lsSigmaAngleSeconds: num(process.ls_sigma_angle_seconds),
    lsSigmaDistanceM: num(process.ls_sigma_distance_m),
    lsDistanceMeasurements: num(process.ls_distance_measurements),
    notes: process.notes,
  };
}

/** Promedio de las lecturas, en grados decimales; `NaN` sin lecturas. */
export function stationAngle(st: StationEdit): number {
  return (
    averageReadings(st.readings.map((r) => dmsToDecimal(r.deg, r.min, r.sec))) ?? Number.NaN
  );
}

const hasOrientation = (a: AmarreEdit) => a.referencePointId !== null || a.referenceCode !== null;

/** La carga del guardado, completa: la acción reescribe el proceso entero. */
export function payloadOf(processId: string, draft: PolygonalDraft): SavePolygonalPayload {
  const { amarre: a, details: d } = draft;
  const controlled = d.type === "open_controlled";
  return {
    processId,
    name: d.name,
    type: d.type,
    location: d.location,
    responsibleName: d.responsibleName,
    responsibleRole: d.responsibleRole,
    equipmentBrand: d.equipmentBrand,
    equipmentModel: d.equipmentModel,
    equipmentSerial: d.equipmentSerial,
    startPointCode: a.startCode,
    startNorth: a.startNorth,
    startEast: a.startEast,
    startAzimuthDeg: a.startAzimuth?.deg ?? null,
    startAzimuthMin: a.startAzimuth?.min ?? null,
    startAzimuthSec: a.startAzimuth?.sec ?? null,
    endPointCode: controlled ? a.endCode : null,
    endNorth: controlled ? a.endNorth : null,
    endEast: controlled ? a.endEast : null,
    endAzimuthDeg: controlled ? (a.endAzimuth?.deg ?? null) : null,
    endAzimuthMin: controlled ? (a.endAzimuth?.min ?? null) : null,
    endAzimuthSec: controlled ? (a.endAzimuth?.sec ?? null) : null,
    referencePointId: a.referencePointId,
    referencePointCode: a.referenceCode,
    hasClosingRow: d.type === "closed" && hasOrientation(a) && a.hasClosingRow,
    // La abierta sin control no se ajusta, y el servidor rechaza mínimos
    // cuadrados en ella: pasa a serlo desde «Editar datos» sin selector a mano.
    correctionMethod: d.type === "open_uncontrolled" && draft.method === "least_squares" ? "bowditch" : draft.method,
    // Con cualquier método: así volver a mínimos cuadrados no los pide de
    // nuevo. Solo llegan aquí pesos válidos (los de la base o los del popup).
    lsSigmaAngleSeconds: draft.lsSigmaAngleSeconds,
    lsSigmaDistanceM: draft.lsSigmaDistanceM,
    lsDistanceMeasurements: draft.lsDistanceMeasurements,
    notes: draft.notes,
    stations: draft.stations.map((st) => ({
      pointCode: st.pointCode,
      angleDeg: null,
      angleMin: null,
      angleSec: null,
      readings: st.readings,
      deflectionDirection: controlled ? st.deflectionDirection : null,
      horizontalDistance: st.distance,
    })),
  };
}

/**
 * La entrada del cálculo en vivo, en el navegador. El azimut de partida es el
 * del borrador, en DMS a la décima de segundo: el mismo que el servidor recibe
 * y con el que calcula. Solo si falta y hay referencia del catálogo, se saca de
 * sus coordenadas, redondeado igual.
 */
export function inputOf(
  draft: PolygonalDraft,
  reference: { north: number; east: number } | null,
): Omit<PolygonalInput, "order" | "angleType"> {
  const { amarre: a, details: d } = draft;
  const controlled = d.type === "open_controlled";
  const azimuth =
    a.startAzimuth ??
    (a.referencePointId !== null && reference !== null
      ? azimuthToReference(a, reference)
      : null);
  return {
    type: d.type,
    startNorth: a.startNorth,
    startEast: a.startEast,
    startAzimuth: azimuth ? dmsToDecimal(azimuth.deg, azimuth.min, azimuth.sec) : Number.NaN,
    endNorth: controlled ? a.endNorth : null,
    endEast: controlled ? a.endEast : null,
    endAzimuth:
      controlled && a.endAzimuth ? dmsToDecimal(a.endAzimuth.deg, a.endAzimuth.min, a.endAzimuth.sec) : null,
    method: draft.method,
    hasOrientation: hasOrientation(a),
    hasClosingRow: d.type === "closed" && hasOrientation(a) && a.hasClosingRow,
    leastSquares:
      draft.lsSigmaAngleSeconds != null && draft.lsSigmaDistanceM != null && draft.lsDistanceMeasurements != null
        ? {
            sigmaAngleSeconds: draft.lsSigmaAngleSeconds,
            sigmaDistanceM: draft.lsSigmaDistanceM,
            distanceMeasurements: draft.lsDistanceMeasurements,
          }
        : null,
    stations: draft.stations.map((st) => ({
      pointCode: st.pointCode,
      angle: stationAngle(st),
      deflectionDirection: controlled ? st.deflectionDirection : null,
      distance: st.distance,
      readings: st.readings.map((r, i) => ({ order: i + 1, angle: dmsToDecimal(r.deg, r.min, r.sec) })),
    })),
  };
}

/**
 * Azimut de la estación de partida a la referencia, en DMS a la décima de
 * segundo: lo que el popup del amarre guarda en el borrador.
 */
export function azimuthToReference(
  start: { startNorth: number; startEast: number },
  reference: { north: number; east: number },
): Dms3 {
  return decimalToDms(
    azimuthFromCoordinates(start.startNorth, start.startEast, reference.north, reference.east),
  );
}
