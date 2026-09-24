// Utilidades de ángulos — funciones puras (PRD § 6.1).
// Sin React, sin Supabase. Solo aritmética.

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
  if (fields.deg.trim() === "") return null;
  const deg = Number(fields.deg);
  const min = Number(fields.min.trim() === "" ? 0 : fields.min);
  const sec = Number(fields.sec.trim() === "" ? 0 : fields.sec);
  if (![deg, min, sec].every(Number.isFinite)) return null;
  return dmsToDecimal(deg, min, sec);
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
  return Math.abs(dmsToDecimal(deg, min, sec) - decimal) > 1e-9;
}
