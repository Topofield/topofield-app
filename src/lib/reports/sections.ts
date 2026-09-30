// Carga de las secciones del informe (Fase 22).
//
// Estaba dentro de la página de impresión del informe consolidado. Salió para
// que la pestaña Informe de cada proceso arme su sección con el mismo código:
// el informe de un proceso y el consolidado no pueden diferir.
//
// El contenido se reconstruye en cada visita a partir de los procesos que el
// informe referencia (ver la página de impresión).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  getLevelingProcess,
  getLevelingReadings,
  getPolygonalProcess,
  getPolygonalStations,
  getReferencePoints,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { computeHistory, pointInputOf } from "@/lib/calculations/settlement";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { polygonalInputOf } from "@/components/polygonal/polygonal-draft";
import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";
import type { PointInput, VisitInput } from "@/types/settlement";
import type { IncludedProcess } from "@/types/report";

type Client = SupabaseClient<Database>;

export interface PolygonalSectionData {
  process: NonNullable<Awaited<ReturnType<typeof getPolygonalProcess>>>;
  stations: Awaited<ReturnType<typeof getPolygonalStations>>;
  /**
   * Lo que consume el dibujo (Fase 13). La entrada sale de `polygonalInputOf`,
   * el mismo camino que usa el editor, así que el dibujo del informe es por
   * construcción el del editor.
   */
  plot: {
    input: PolygonalInput;
    result: PolygonalResult;
    reference: { code: string; north: number; east: number } | null;
  };
}

export interface LevelingSectionData {
  process: NonNullable<Awaited<ReturnType<typeof getLevelingProcess>>>;
  readings: Awaited<ReturnType<typeof getLevelingReadings>>;
}

export interface SiteSectionData {
  site: NonNullable<Awaited<ReturnType<typeof getSite>>>;
  points: Awaited<ReturnType<typeof getSitePoints>>;
  /** Los mismos puntos en la forma que consume la gráfica. */
  pointInputs: PointInput[];
  visits: Awaited<ReturnType<typeof getVisits>>;
  history: ReturnType<typeof computeHistory>;
}

/** Una sección del informe, ya resuelta a datos. */
export type ReportSection =
  | { kind: "polygonal"; entry: IncludedProcess; data: PolygonalSectionData }
  | { kind: "leveling"; entry: IncludedProcess; data: LevelingSectionData }
  | { kind: "site"; entry: IncludedProcess; data: SiteSectionData }
  | { kind: "missing"; entry: IncludedProcess; data: null };

/**
 * Resuelve cada entrada del informe a sus datos. Una entrada cuyo proceso ya
 * no existe, o que no es del proyecto, queda como `missing`.
 */
export async function loadReportSections(
  supabase: Client,
  projectId: string,
  entries: IncludedProcess[],
): Promise<ReportSection[]> {
  // Catálogo de amarres, una sola vez por informe y solo si hay poligonales:
  // el dibujo de cada una lo necesita para su punto de amarre.
  const referencePoints = entries.some((e) => e.type === "polygonal")
    ? await getReferencePoints(supabase, projectId)
    : [];

  return Promise.all(
    entries.map(async (entry): Promise<ReportSection> => {
      if (entry.type === "polygonal") {
        const process = await getPolygonalProcess(supabase, entry.id);
        if (!process || process.project_id !== projectId) {
          return { kind: "missing", entry, data: null };
        }
        const stations = await getPolygonalStations(supabase, process.id);
        const input = polygonalInputOf(process, stations);
        const amarre = referencePoints.find((p) => p.id === process.reference_point_id);
        const reference =
          amarre && amarre.north !== null && amarre.east !== null
            ? { code: amarre.code, north: Number(amarre.north), east: Number(amarre.east) }
            : null;
        return {
          kind: "polygonal",
          entry,
          data: { process, stations, plot: { input, result: computePolygonal(input), reference } },
        };
      }
      if (entry.type === "leveling") {
        const process = await getLevelingProcess(supabase, entry.id);
        if (!process || process.project_id !== projectId) {
          return { kind: "missing", entry, data: null };
        }
        const readings = await getLevelingReadings(supabase, process.id);
        return { kind: "leveling", entry, data: { process, readings } };
      }
      const site = await getSite(supabase, entry.id);
      if (!site || site.project_id !== projectId) {
        return { kind: "missing", entry, data: null };
      }
      const [points, visits, readingsBySite] = await Promise.all([
        getSitePoints(supabase, site.id),
        getVisits(supabase, site.id),
        getSettlementReadingsBySite(supabase, site.id),
      ]);
      const pointInputs: PointInput[] = points.map(pointInputOf);
      const visitInputs: VisitInput[] = visits.map((v) => ({
        id: v.id,
        visitNumber: v.visit_number,
        date: v.date,
        readings: (readingsBySite[v.id] ?? []).map((r) => ({
          pointId: r.point_id,
          elevation: Number(r.elevation),
        })),
      }));
      const history = computeHistory(pointInputs, visitInputs, thresholdsOf(site));
      return { kind: "site", entry, data: { site, points, pointInputs, visits, history } };
    }),
  );
}

/** Cuándo y quién cerró lo que la sección describe. */
export function closureOf(section: ReportSection): {
  closedAt: string | null;
  closedBy: string | null;
} {
  switch (section.kind) {
    case "polygonal":
    case "leveling":
      return {
        closedAt: section.data.process.closed_at,
        closedBy: section.data.process.closed_by,
      };
    case "site":
      return { closedAt: section.data.site.closed_at, closedBy: section.data.site.closed_by };
    case "missing":
      return { closedAt: null, closedBy: null };
  }
}
