// Dominio vertical de las gráficas de asentamiento (Fase 18). Funciones puras,
// sin React: la regla de qué umbral entra en el eje es la parte que puede
// equivocarse en silencio —una gráfica que no muestra el umbral siguiente
// parece tranquila aunque le falten 2 mm— y así se prueba sin renderizar.

import { niceTicks } from "./chart-scale";

/** Niveles de umbral de acumulado, de menor a mayor gravedad. */
export type ThresholdLevel = "caution" | "alert" | "alarm";

export const THRESHOLD_LEVELS: readonly ThresholdLevel[] = [
  "caution",
  "alert",
  "alarm",
];

/**
 * Umbrales de acumulado del lugar como MAGNITUDES positivas (mm). La gráfica
 * los dibuja en negativo, porque el asentamiento es descenso.
 */
export interface ThresholdMagnitudes {
  caution: number;
  alert: number;
  alarm: number;
}

/** Un umbral ya situado en el eje: `value` es la magnitud en negativo. */
export interface PlacedThreshold {
  level: ThresholdLevel;
  magnitude: number;
  value: number;
}

/** Magnitudes utilizables: un umbral en 0, negativo o no numérico no se dibuja. */
function validThresholds(
  thresholds: ThresholdMagnitudes | null | undefined,
): { level: ThresholdLevel; magnitude: number }[] {
  if (!thresholds) return [];
  return THRESHOLD_LEVELS.map((level) => ({
    level,
    magnitude: thresholds[level],
  })).filter((t) => Number.isFinite(t.magnitude) && t.magnitude > 0);
}

/**
 * Dominio Y «crudo» de una gráfica de asentamiento.
 *
 * - Siempre incluye el 0: la lectura base tiene que verse aunque todo se haya
 *   hundido.
 * - Incluye todos los datos. Los positivos (levantamiento) lo extienden hacia
 *   arriba.
 * - Incluye el umbral **siguiente** al dato más hundido: el de menor magnitud
 *   estrictamente mayor que el mayor descenso. Así se ve cuánto falta para
 *   él. Un dato justo en un umbral ya lo muestra, y el eje llega al siguiente.
 *   Pasado el de alarma no se añade nada: los datos ya lo contienen.
 */
export function settlementDomain(
  values: readonly number[],
  thresholds?: ThresholdMagnitudes | null,
): [number, number] {
  const finite = values.filter((v) => Number.isFinite(v));
  let min = Math.min(0, ...finite);
  const max = Math.max(0, ...finite);

  const deepest = -min;
  const beyond = validThresholds(thresholds)
    .map((t) => t.magnitude)
    .filter((m) => m > deepest);
  if (beyond.length > 0) min = -Math.min(...beyond);

  return [min, max];
}

/**
 * Umbrales que caen dentro de `[min, max]` (bordes incluidos), en negativo y
 * ordenados de menor a mayor gravedad. Uno que quede fuera no se dibuja: una
 * línea pegada al borde del gráfico se leería como un dato.
 */
export function thresholdsInDomain(
  thresholds: ThresholdMagnitudes | null | undefined,
  [min, max]: [number, number],
): PlacedThreshold[] {
  return validThresholds(thresholds)
    .map((t) => ({ ...t, value: -t.magnitude }))
    .filter((t) => t.value >= min && t.value <= max)
    .sort((a, b) => a.magnitude - b.magnitude);
}

/**
 * Eje Y completo: marcas redondas que cubren el dominio de
 * `settlementDomain`, el dominio final (el de las marcas, que puede ser algo
 * más amplio) y los umbrales que caben en él.
 */
export function settlementAxis(
  values: readonly number[],
  thresholds: ThresholdMagnitudes | null | undefined,
  tickCount: number,
): { ticks: number[]; domain: [number, number]; thresholds: PlacedThreshold[] } {
  const [rawMin, rawMax] = settlementDomain(values, thresholds);
  const ticks = niceTicks(rawMin, rawMax, tickCount);
  const domain: [number, number] = [
    ticks[0] ?? rawMin,
    ticks[ticks.length - 1] ?? rawMax,
  ];
  return { ticks, domain, thresholds: thresholdsInDomain(thresholds, domain) };
}
