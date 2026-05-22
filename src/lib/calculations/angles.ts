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
