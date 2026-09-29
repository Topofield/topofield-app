// Formato de valores del informe imprimible. Salieron de la página de
// impresión al extraer sus secciones (Fase 22), sin cambiar el resultado.

/** Número, o `null` si falta o no es número. La base devuelve texto o número. */
export function n(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const v = Number(value);
  return Number.isFinite(v) ? v : null;
}

/** Número a `decimals` cifras, o "—". */
export function fixed(value: number | string | null | undefined, decimals: number): string {
  const v = n(value);
  return v === null ? "—" : v.toFixed(decimals);
}

/** Ángulo en grados, minutos y segundos como en la libreta, o "—". */
export function dms(deg: number | null, min: number | null, sec: number | null): string {
  if (deg === null || min === null || sec === null) return "—";
  return `${deg}° ${min}' ${sec}"`;
}
