// Plan de una georreferenciación (Fase 15): de las filas del proceso y los dos
// puntos de control, a lo que hay que escribir.
//
// Sin «use client»: lo usan la vista previa del diálogo (cliente) y la acción
// del servidor, que así escribe exactamente lo que el usuario vio. Parte de
// `polygonalInputOf`, el mismo camino que el editor, el informe y el Excel.

import { decimalToDms } from "@/lib/calculations/angles";
import { formatDate } from "@/lib/utils/format";
import {
  fitTwoPoints,
  georeferenceInput,
  scaleWithinOrder,
  type PlanePoint,
  type TwoPointFit,
} from "@/lib/calculations/georeference";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { validateGeoreferencePoints } from "@/lib/validators/polygonal";
import type {
  PolygonalProcess,
  PolygonalResult,
  PolygonalStationWithReadings,
} from "@/types/polygonal";
import { polygonalInputOf } from "./polygonal-draft";

export interface ControlPoint {
  /** Índice de la estación en las filas del proceso, en orden. */
  index: number | null;
  north: number | null;
  east: number | null;
}

type Dms = { deg: number; min: number; sec: number };

export interface GeoreferencePlan {
  fit: TwoPointFit;
  /** Coordenadas finales recalculadas menos las reales tecleadas, en A y en B. */
  residuals: [PlanePoint, PlanePoint];
  scaleWithinOrder: boolean;
  before: PolygonalResult;
  after: PolygonalResult;
  pointCodes: [string, string];
  /** Columnas de la cabecera; `georef_at`/`georef_by` los pone la acción. */
  header: {
    start_north: number;
    start_east: number;
    start_azimuth_deg: number;
    start_azimuth_min: number;
    start_azimuth_sec: number;
    end_north: number | null;
    end_east: number | null;
    end_azimuth_deg: number | null;
    end_azimuth_min: number | null;
    end_azimuth_sec: number | null;
    reference_point_id: null;
    georef_point_a_code: string;
    georef_point_b_code: string;
    georef_rotation_deg: number;
    georef_rotation_min: number;
    georef_rotation_sec: number;
    georef_scale_factor: number;
  };
  /** Columnas de posición de cada estación, por su id. */
  stations: {
    id: string;
    azimuth_deg: number | null;
    azimuth_min: number | null;
    azimuth_sec: number | null;
    delta_north: number | null;
    delta_east: number | null;
    corrected_delta_north: number | null;
    corrected_delta_east: number | null;
    north: number | null;
    east: number | null;
  }[];
}

function dmsOrNull(deg: number | null): Dms | null {
  return deg == null || !Number.isFinite(deg) ? null : decimalToDms(deg);
}

/**
 * ¿Es el mismo veredicto? A la resolución de las columnas: arranque y llegada
 * se redondean a 0.1 mm, y en una abierta con control su posición relativa es
 * el cierre, así que el error lineal puede moverse unas centésimas de mm.
 */
function sameVerdict(a: PolygonalResult, b: PolygonalResult): boolean {
  const close = (x: number | null, y: number | null, tol: number) =>
    x === y || (x != null && y != null && Math.abs(x - y) <= tol);
  return (
    close(a.angularError, b.angularError, 0.05) &&
    close(a.linearError, b.linearError, 1e-4) &&
    close(a.perimeter, b.perimeter, 1e-6) &&
    a.meetsTolerance === b.meetsTolerance
  );
}

export function planGeoreference(
  process: PolygonalProcess,
  stations: PolygonalStationWithReadings[],
  a: ControlPoint,
  b: ControlPoint,
): { ok: true; plan: GeoreferencePlan } | { ok: false; error: string } {
  const input = polygonalInputOf(process, stations);
  const before = computePolygonal(input);

  const error = validateGeoreferencePoints(before.stations, a, b);
  if (error) return { ok: false, error };
  // El validador garantiza índices, coordenadas y valores finitos.
  const ia = a.index!;
  const ib = b.index!;
  const local = (i: number) => ({ north: before.stations[i]!.north!, east: before.stations[i]!.east! });
  const realA = { north: a.north!, east: a.east! };
  const realB = { north: b.north!, east: b.east! };

  const fit = fitTwoPoints(local(ia), local(ib), realA, realB);
  if (!fit) return { ok: false, error: "Los dos puntos no definen una dirección." };

  const moved = georeferenceInput(input, fit.transform);
  const after = computePolygonal(moved);
  if (!sameVerdict(before, after)) {
    // No debería pasar nunca: una transformación rígida no cambia el cierre.
    return { ok: false, error: "La georreferenciación cambiaría el veredicto; no se aplica." };
  }

  const residual = (i: number, real: PlanePoint) => ({
    north: (after.stations[i]?.north ?? Number.NaN) - real.north,
    east: (after.stations[i]?.east ?? Number.NaN) - real.east,
  });
  const startAz = decimalToDms(moved.startAzimuth);
  const endAz = dmsOrNull(moved.endAzimuth);
  const rotation = decimalToDms(fit.transform.rotation);

  return {
    ok: true,
    plan: {
      fit,
      residuals: [residual(ia, realA), residual(ib, realB)],
      scaleWithinOrder: scaleWithinOrder(fit.scaleFactor, input.order),
      before,
      after,
      pointCodes: [stations[ia]!.point_code, stations[ib]!.point_code],
      header: {
        start_north: moved.startNorth,
        start_east: moved.startEast,
        start_azimuth_deg: startAz.deg,
        start_azimuth_min: startAz.min,
        start_azimuth_sec: startAz.sec,
        end_north: process.end_north != null ? moved.endNorth : null,
        end_east: process.end_east != null ? moved.endEast : null,
        end_azimuth_deg: endAz?.deg ?? null,
        end_azimuth_min: endAz?.min ?? null,
        end_azimuth_sec: endAz?.sec ?? null,
        // Un amarre del catálogo pasa a manual: su coordenada sigue en el
        // sistema local y, en el siguiente guardado, desharía la rotación
        // (PRD, decisión 7). El código se conserva.
        reference_point_id: null,
        georef_point_a_code: stations[ia]!.point_code,
        georef_point_b_code: stations[ib]!.point_code,
        georef_rotation_deg: rotation.deg,
        georef_rotation_min: rotation.min,
        georef_rotation_sec: rotation.sec,
        georef_scale_factor: fit.scaleFactor,
      },
      stations: stations.map((st, i) => {
        const r = after.stations[i];
        const az = dmsOrNull(r?.azimuth ?? null);
        return {
          id: st.id,
          azimuth_deg: az?.deg ?? null,
          azimuth_min: az?.min ?? null,
          azimuth_sec: az?.sec ?? null,
          delta_north: r?.deltaNorth ?? null,
          delta_east: r?.deltaEast ?? null,
          corrected_delta_north: r?.correctedDeltaNorth ?? null,
          corrected_delta_east: r?.correctedDeltaEast ?? null,
          north: r?.north ?? null,
          east: r?.east ?? null,
        };
      }),
    },
  };
}

/** Una rotación en DMS como texto: 35° 00′ 07.8″. */
export function formatRotation(deg: number, min: number, sec: number): string {
  return `${deg}° ${String(min).padStart(2, "0")}′ ${sec.toFixed(1).padStart(4, "0")}″`;
}

/**
 * La última georreferenciación en una frase, para el editor, el informe y el
 * Excel: «el 24 de septiembre de 2026 con D1 y D3 (rotación …, factor de
 * escala …)». `null` si el proceso nunca se georreferenció.
 */
export function georeferenceSummary(
  p: Pick<
    PolygonalProcess,
    | "georef_at"
    | "georef_point_a_code"
    | "georef_point_b_code"
    | "georef_rotation_deg"
    | "georef_rotation_min"
    | "georef_rotation_sec"
    | "georef_scale_factor"
  >,
): string | null {
  if (!p.georef_at) return null;
  const rotation =
    p.georef_rotation_deg != null
      ? formatRotation(
          p.georef_rotation_deg,
          p.georef_rotation_min ?? 0,
          Number(p.georef_rotation_sec ?? 0),
        )
      : "—";
  const scale = p.georef_scale_factor != null ? Number(p.georef_scale_factor).toFixed(6) : "—";
  return `el ${formatDate(p.georef_at)} con ${p.georef_point_a_code} y ${p.georef_point_b_code} (rotación ${rotation}, factor de escala ${scale})`;
}
