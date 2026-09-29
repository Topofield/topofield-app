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
