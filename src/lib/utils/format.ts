// Formateo de valores para la interfaz. Zona horaria America/Bogota e idioma
// español (Colombia), según CLAUDE.md.

/** Formatea una fecha ISO como "21 de mayo de 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}
