// La portada de un informe a partir del proyecto (Fase 23).

import type { Project } from "@/types/project";
import type { ReportCoverData } from "@/types/report";

/**
 * Los datos del proyecto que muestra la portada. Al emitir un informe
 * consolidado se guardan en `reports.cover` y ya no cambian; la pestaña
 * Informe de un proceso los toma en vivo.
 */
export function coverOf(
  project: Pick<Project, "name" | "client" | "location" | "datum" | "projection">,
): ReportCoverData {
  return {
    name: project.name,
    client: project.client,
    location: project.location,
    datum: project.datum,
    projection: project.projection,
  };
}
