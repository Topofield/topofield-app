// La portada del informe de un proceso a partir del proyecto (Fases 23 y 38).

import type { Project } from "@/types/project";
import type { ReportCoverData } from "@/types/report";

/** Los datos del proyecto que muestra la portada, tomados en vivo. */
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
