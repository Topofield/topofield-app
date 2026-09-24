// Georreferenciación de poligonales (Fase 15). Funciones puras: sin React,
// sin Supabase. Solo geometría.
//
// Una poligonal medida en un sistema local se lleva al real con dos de sus
// estaciones de coordenadas conocidas. La transformación es RÍGIDA —rotación
// más traslación, sin escala—: una escala cambiaría las distancias medidas y,
// con ellas, el error lineal y el perímetro que certificó el cierre. El factor
// de escala se calcula solo como control. Ver docs/prds/14-georreferenciacion.md.

import { azimuthFromCoordinates, cosDeg, normalizeAzimuth, sinDeg } from "./angles";
import { minRelativePrecision } from "./tolerances";
import type { PolygonalInput } from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";

export interface PlanePoint {
  north: number;
  east: number;
}

/**
 * `real = R(θ) · local + t`. La rotación va en el sentido de los azimuts
 * (horario desde el norte), así que un azimut local se lleva al real sumándole
 * `rotation`.
 */
export interface RigidTransform {
  /** θ en grados decimales, en [0, 360), múltiplo de 0.1″. */
  rotation: number;
  shiftNorth: number;
  shiftEast: number;
}

export interface TwoPointFit {
  transform: RigidTransform;
  /** |B − A| real / |b − a| local. Informativo: no se aplica. */
  scaleFactor: number;
  localDistance: number;
  realDistance: number;
}

/**
 * Un ángulo en [0, 360) redondeado a la resolución de las columnas DMS, 0.1″.
 * Se normaliza después de redondear: 359°59′59.97″ redondea a 360°, que es 0°.
 */
function azimuthToTenthSecond(deg: number): number {
  return normalizeAzimuth(Math.round(normalizeAzimuth(deg) * 36000) / 36000);
}

/** Redondea a la resolución de `decimal(12,4)`: 0.1 mm. */
function roundToTenthMm(m: number): number {
  return Math.round(m * 10000) / 10000;
}

export function applyTransform(t: RigidTransform, p: PlanePoint): PlanePoint {
  const c = cosDeg(t.rotation);
  const s = sinDeg(t.rotation);
  return {
    north: t.shiftNorth + p.north * c - p.east * s,
    east: t.shiftEast + p.north * s + p.east * c,
  };
}

/**
 * Transformación rígida que lleva `localA`, `localB` a `realA`, `realB`:
 * θ es la diferencia de azimuts de la línea A→B, y la traslación hace
 * coincidir los centroides. Con dos puntos no hay redundancia para la
 * rotación; la discrepancia de distancia se reparte por igual entre A y B.
 *
 * `null` si los dos puntos coinciden, en local o en real: sin línea no hay
 * rotación.
 */
export function fitTwoPoints(
  localA: PlanePoint,
  localB: PlanePoint,
  realA: PlanePoint,
  realB: PlanePoint,
): TwoPointFit | null {
  const localDistance = Math.hypot(localB.north - localA.north, localB.east - localA.east);
  const realDistance = Math.hypot(realB.north - realA.north, realB.east - realA.east);
  // 1 mm: por debajo, los puntos son el mismo.
  if (!(localDistance >= 0.001) || !(realDistance >= 0.001)) return null;

  const rotation = azimuthToTenthSecond(
    azimuthFromCoordinates(realA.north, realA.east, realB.north, realB.east) -
      azimuthFromCoordinates(localA.north, localA.east, localB.north, localB.east),
  );
  const localCentroid = {
    north: (localA.north + localB.north) / 2,
    east: (localA.east + localB.east) / 2,
  };
  const rotated = applyTransform({ rotation, shiftNorth: 0, shiftEast: 0 }, localCentroid);
  return {
    transform: {
      rotation,
      shiftNorth: roundToTenthMm((realA.north + realB.north) / 2 - rotated.north),
      shiftEast: roundToTenthMm((realA.east + realB.east) / 2 - rotated.east),
    },
    scaleFactor: realDistance / localDistance,
    localDistance,
    realDistance,
  };
}

/**
 * La entrada del cálculo llevada al sistema real: el punto y el azimut de
 * arranque y, en la abierta con control, el punto y el azimut de llegada.
 * Ángulos y distancias no cambian. Se RECALCULA con esta entrada, no se rota
 * lo calculado: con Tránsito los dos caminos no dan lo mismo (PRD, hallazgo 1).
 */
export function georeferenceInput(input: PolygonalInput, t: RigidTransform): PolygonalInput {
  const start = applyTransform(t, { north: input.startNorth, east: input.startEast });
  const end =
    input.endNorth != null && input.endEast != null
      ? applyTransform(t, { north: input.endNorth, east: input.endEast })
      : null;
  return {
    ...input,
    startNorth: roundToTenthMm(start.north),
    startEast: roundToTenthMm(start.east),
    startAzimuth: azimuthToTenthSecond(input.startAzimuth + t.rotation),
    endNorth: end ? roundToTenthMm(end.north) : input.endNorth,
    endEast: end ? roundToTenthMm(end.east) : input.endEast,
    endAzimuth:
      input.endAzimuth != null
        ? azimuthToTenthSecond(input.endAzimuth + t.rotation)
        : null,
  };
}

/**
 * ¿Concuerda el factor de escala con la precisión del orden? Fuera de ella
 * se avisa, no se bloquea: una proyección con factor ≠ 1 la supera sin que
 * haya error (PRD, decisión 11).
 */
export function scaleWithinOrder(scaleFactor: number, order: PrecisionOrder): boolean {
  return Math.abs(scaleFactor - 1) <= 1 / minRelativePrecision(order);
}
