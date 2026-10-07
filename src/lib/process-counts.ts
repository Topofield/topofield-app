// Cuántos procesos tiene un proyecto (Fase 24).

/**
 * Conteo de los trabajos de un proyecto: poligonales, nivelaciones y lugares
 * de control de asentamientos (un lugar = un trabajo, como en el KPI). Hasta
 * la Fase 37 se desglosaba por estado; desde que nada se cierra, es el total.
 */
export interface ProcessCounts {
  total: number;
}

export const NO_PROCESSES: ProcessCounts = { total: 0 };

/** «6 procesos». */
export function processCountsLabel(counts: ProcessCounts): string {
  return `${counts.total} ${counts.total === 1 ? "proceso" : "procesos"}`;
}
