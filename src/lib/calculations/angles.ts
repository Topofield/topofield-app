// Utilidades de ángulos — funciones puras (PRD § 6.1).
// Sin React, sin Supabase. Solo aritmética.

import { readNumberText } from "@/lib/utils/parse";

export interface Dms {
  deg: number;
  min: number;
  sec: number;
}

/** Convierte grados, minutos y segundos a grados decimales. */
export function dmsToDecimal(deg: number, min: number, sec: number): number {
  const sign = deg < 0 ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

/**
 * Convierte grados decimales a grados, minutos y segundos. Los segundos se
 * redondean a 1 decimal y se acarrea el desbordamiento (60" → +1', 60' → +1°)
 * para no devolver nunca 60 en minutos o segundos.
 */
export function decimalToDms(decimal: number): Dms {
  const sign = decimal < 0 ? -1 : 1;
  const abs = Math.abs(decimal);

  let deg = Math.floor(abs);
  let min = Math.floor((abs - deg) * 60);
  let sec = Math.round(((abs - deg) * 60 - min) * 60 * 10) / 10;

  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }
  return { deg: sign * deg, min, sec };
}

/** Normaliza un azimut al rango [0, 360) grados. */
export function normalizeAzimuth(az: number): number {
  return ((az % 360) + 360) % 360;
}

/** Convierte grados decimales a segundos de arco. */
export function degreesToSeconds(deg: number): number {
  return deg * 3600;
}

/** Coseno de un ángulo dado en grados. */
export function cosDeg(deg: number): number {
  return Math.cos((deg * Math.PI) / 180);
}

/** Seno de un ángulo dado en grados. */
export function sinDeg(deg: number): number {
  return Math.sin((deg * Math.PI) / 180);
}

/**
 * Azimut de la dirección `from → to` a partir de coordenadas planas, en grados
 * decimales normalizados a [0, 360).
 *
 * El azimut se mide desde el Norte en sentido horario, así que el ángulo es
 * `atan2(ΔE, ΔN)` y no `atan2(ΔN, ΔE)`: el Norte hace de eje de referencia y el
 * Este de eje que crece hacia la derecha.
 *
 * Dos puntos coincidentes no definen dirección; se devuelve 0 en vez de
 * propagar el 0 arbitrario de `atan2(0, 0)` como si fuera un dato.
 */
export function azimuthFromCoordinates(
  fromNorth: number,
  fromEast: number,
  toNorth: number,
  toEast: number,
): number {
  const deltaNorth = toNorth - fromNorth;
  const deltaEast = toEast - fromEast;
  if (deltaNorth === 0 && deltaEast === 0) return 0;
  return normalizeAzimuth((Math.atan2(deltaEast, deltaNorth) * 180) / Math.PI);
}

/** Diferencia `angle − reference` llevada a (−180°, 180°]. */
export function angularDeviation(angle: number, reference: number): number {
  const d = normalizeAzimuth(angle - reference);
  return d > 180 ? d - 360 : d;
}

/**
 * Promedio de las lecturas de un mismo ángulo, en grados decimales, redondeado
 * a la décima de segundo con que se guarda la estación. `null` sin lecturas.
 *
 * Es el único promedio de lecturas (Fase 26): lo usan el editor y el servidor,
 * así que el cálculo que se guarda es el que se ve (C-4). Cada lectura se toma
 * respecto a la primera, en (−180°, 180°], antes de promediar (C-6): 359°59′56″,
 * 0°00′02″ y 0°00′06″ promedian 0°00′01.3″, no 120°. El promedio solo se lleva
 * a [0°, 360°] si se sale: 360°00′00″ exacto sigue valiendo, como en la regla
 * de la lectura (Fase 24).
 */
export function averageReadings(values: readonly number[]): number | null {
  const first = values[0];
  if (first === undefined) return null;
  const spread = values.reduce((acc, v) => acc + angularDeviation(v, first), 0);
  let mean = first + spread / values.length;
  if (mean < 0) mean += 360;
  else if (mean > 360) mean -= 360;
  const { deg, min, sec } = decimalToDms(mean);
  return dmsToDecimal(deg, min, sec);
}

/**
 * Dispersión de las lecturas de un mismo ángulo —la mayor menos la menor—, en
 * segundos de arco, con el mismo desenvolvimiento que `averageReadings`. `null`
 * con menos de dos lecturas.
 */
export function readingSpreadSeconds(values: readonly number[]): number | null {
  const first = values[0];
  if (first === undefined || values.length < 2) return null;
  const deviations = values.map((v) => angularDeviation(v, first));
  return degreesToSeconds(Math.max(...deviations) - Math.min(...deviations));
}

// ----------------------------------------------------------------------------
// Captura en grados decimales (Fase 13, P1)
// ----------------------------------------------------------------------------
//
// El almacenamiento sigue en DMS con los segundos a la décima. Estas funciones
// solo traducen la VISTA de un campo de captura entre DMS y decimal.

/** Un ángulo como lo tienen los campos de captura: texto de cada casilla. */
export interface DmsFields {
  deg: string;
  min: string;
  sec: string;
}

/**
 * Decimales con que se muestra un ángulo en grados decimales. 0.000001° son
 * 0.0036″, muy por debajo de la décima de segundo que se guarda, así que ir
 * de DMS a decimal y volver devuelve exactamente el mismo DMS.
 */
export const DECIMAL_DEGREE_DIGITS = 6;

/**
 * El ángulo de unos campos DMS en grados decimales, o `null` si no hay grados.
 * Minutos y segundos en blanco valen 0 —es lo que espera quien teclea un
 * ángulo redondo— y un valor no numérico da `null`.
 */
export function dmsFieldsToDecimal(fields: DmsFields): number | null {
  const deg = readNumberText(fields.deg);
  if (deg.kind !== "number") return null;
  const min = dmsFieldValue(fields.min);
  const sec = dmsFieldValue(fields.sec);
  if (min === null || sec === null) return null;
  return dmsToDecimal(deg.value, min, sec);
}

/**
 * El valor de una casilla de minutos o segundos: en blanco vale 0 y un texto
 * que no es número da `null`. Con coma decimal, como el resto de la captura
 * (Fase 20): `Number("12,5")` es `NaN` y la lectura se perdía (Fase 26, C-5).
 */
export function dmsFieldValue(text: string): number | null {
  const read = readNumberText(text);
  if (read.kind === "empty") return 0;
  return read.kind === "number" ? read.value : null;
}

/** Grados decimales con los decimales de la vista. */
export function formatDecimalDegrees(decimal: number): string {
  return decimal.toFixed(DECIMAL_DEGREE_DIGITS);
}

/** Campos DMS de un ángulo decimal, ya redondeados a la décima de segundo. */
export function decimalToDmsFields(decimal: number): DmsFields {
  const { deg, min, sec } = decimalToDms(decimal);
  return { deg: String(deg), min: String(min), sec: String(sec) };
}

/**
 * ¿El ángulo decimal tiene más precisión que la décima de segundo que se
 * guarda? Si es así, al guardarse se redondea y hay que avisarlo.
 */
export function roundsOnStorage(decimal: number): boolean {
  const { deg, min, sec } = decimalToDms(decimal);
  // Media unidad del último decimal de la vista (Fase 26, C-17): un ángulo
  // guardado se muestra redondeado a 0.000001°, y con un umbral menor pasar a
  // la vista decimal avisaba de un redondeo que nadie había tecleado.
  return Math.abs(dmsToDecimal(deg, min, sec) - decimal) > DECIMAL_VIEW_HALF_UNIT;
}

const DECIMAL_VIEW_HALF_UNIT = 0.5 * 10 ** -DECIMAL_DEGREE_DIGITS;
