// La precisión de cada punto como se muestra (Fase 39): una sola forma para la
// tabla de Ajuste y la del informe, que de otro modo se separarían.

import type { AdjustedPrecision, AngleInputFormat, PointPrecision } from "@/types/polygonal";
import { formatAngle } from "./angle-format";

/** Los encabezados de las columnas, tras la del punto. */
export const PRECISION_HEADERS = [
  "σ N (mm)",
  "σ E (mm)",
  "Semieje mayor (mm)",
  "Semieje menor (mm)",
  "Azimut del mayor",
] as const;

/** Lo que dice la fila de un punto fijo: la partida, la vuelta a ella o la llegada. */
export const FIXED_POINT_TEXT = "Punto fijo: sin elipse.";

/** Las celdas de la fila de un punto: σ N, σ E y los semiejes en mm, y el azimut del mayor. */
export function precisionCells(p: PointPrecision, angleFormat: AngleInputFormat): string[] {
  const mm = (meters: number) => (meters * 1000).toFixed(1);
  return [
    mm(p.sigmaNorth),
    mm(p.sigmaEast),
    mm(p.ellipse.semiMajor),
    mm(p.ellipse.semiMinor),
    formatAngle(p.ellipse.majorAzimuth, angleFormat),
  ];
}

/**
 * ¿Es plana la elipse del primer punto tras la partida? El azimut del primer
 * lado es el datum, así que ese punto solo se mueve a lo largo de él.
 */
export function firstPointFlat(precision: AdjustedPrecision): boolean {
  const p = precision.stations[1];
  return !!p && p.ellipse.semiMajor > 0 && p.ellipse.semiMinor < 1e-4 * p.ellipse.semiMajor;
}
