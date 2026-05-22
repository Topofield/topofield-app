// Formateo de valores para la interfaz. Zona horaria America/Bogota e idioma
// español (Colombia), según CLAUDE.md.

/** Formatea un timestamp ISO (timestamptz) como "21 de mayo de 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}

/**
 * Formatea una fecha sin hora ("YYYY-MM-DD", columnas DATE) como
 * "21 de mayo de 2026". No aplica zona horaria para no desplazar el día.
 */
export function formatDateOnly(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
