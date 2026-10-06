// Informes consolidados que incluyen un proceso (Fase 22). Función pura.
//
// `reports.included_processes` es JSONB, sin tabla de unión: se filtra en
// memoria sobre los informes del proyecto, que son pocos.

import type { IncludedProcess, Report } from "@/types/report";

export function reportsIncluding(
  reports: Report[],
  type: IncludedProcess["type"],
  id: string,
): Report[] {
  return reports.filter((r) =>
    r.included_processes.some((p) => p.type === type && p.id === id),
  );
}

/**
 * El aviso al eliminar un proceso o un lugar que está en informes
 * consolidados, o null si no está en ninguno (Fase 34). Solo lo abierto se
 * elimina, así que solo pasa con algo reabierto después de emitir el informe:
 * el informe se reconstruye en vivo y quedará sin esa sección.
 */
export function deletionReportsNotice(titles: string[]): string | null {
  if (titles.length === 0) return null;
  const list = titles.map((t) => `«${t}»`).join(", ");
  return titles.length === 1
    ? `Está en el informe consolidado ${list}, que quedará sin esta sección.`
    : `Está en ${titles.length} informes consolidados: ${list}. Quedarán sin esta sección.`;
}
