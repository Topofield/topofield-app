// Cuántos procesos tiene un proyecto, por estado (Fase 24).

/**
 * Conteo de los trabajos de un proyecto: poligonales, nivelaciones y lugares
 * de control de asentamientos (un lugar = un trabajo, como en el KPI). «En
 * curso» reúne borrador, en progreso y calculado, y los lugares activos.
 */
export interface ProcessCounts {
  open: number;
  closed: number;
  rejected: number;
}

export const NO_PROCESSES: ProcessCounts = { open: 0, closed: 0, rejected: 0 };

/** El grupo al que suma un proceso o un lugar según su `status`. */
export function countGroupOf(status: string): keyof ProcessCounts {
  if (status === "closed") return "closed";
  if (status === "rejected") return "rejected";
  return "open";
}

/**
 * «6 procesos · 3 en curso · 2 cerrados · 1 rechazado», sin los grupos en
 * cero. Hasta la Fase 24 la tarjeta decía solo «6 procesos».
 */
export function processCountsLabel(counts: ProcessCounts): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const total = counts.open + counts.closed + counts.rejected;
  const parts = [plural(total, "proceso", "procesos")];
  if (counts.open > 0) parts.push(`${counts.open} en curso`);
  if (counts.closed > 0) parts.push(plural(counts.closed, "cerrado", "cerrados"));
  if (counts.rejected > 0) parts.push(plural(counts.rejected, "rechazado", "rechazados"));
  return parts.join(" · ");
}
