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
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import { correctionBreakdown, type CorrectionBreakdown } from "@/lib/calculations/correction-breakdown";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { captureRows, type CaptureRow } from "@/components/polygonal/capture-rows";
import { draftOf, inputOf } from "@/components/polygonal/polygonal-save";
import type { AngleInputFormat, AngleType, PolygonalInput, PolygonalResult } from "@/types/polygonal";
import type { PrecisionOrder } from "@/types/project";
import type { PointInput, VisitInput } from "@/types/settlement";
import type { IncludedProcess } from "@/types/report";

type Client = SupabaseClient<Database>;

export interface PolygonalSectionData {
  process: NonNullable<Awaited<ReturnType<typeof getPolygonalProcess>>>;
  stations: Awaited<ReturnType<typeof getPolygonalStations>>;
  /**
   * El cálculo y el dibujo (Fase 13). La entrada sale de `draftOf` e
   * `inputOf`, el mismo camino que la pantalla por pasos, con el orden y el
   * tipo de ángulo detectados (Fase 35): el informe es por construcción lo
   * que muestran Datos y Ajuste.
   */
  plot: {
    input: PolygonalInput;
    result: PolygonalResult;
    reference: { code: string; north: number; east: number } | null;
  };
  /** Las mediciones «desde → hacia» (Fase 35). */
  rows: CaptureRow[];
  /** Cómo corrigió el método; `null` en la abierta sin control o sin datos. */
  breakdown: CorrectionBreakdown | null;
  /** El orden alcanzado, detectado; `null` sin verificación o sin alcanzarlo. */
  order: PrecisionOrder | null;
  angleType: AngleType;
  /** El código de la referencia del 0 atrás, con o sin coordenadas. */
  referenceLabel: string | null;
  /** El formato de los ángulos del proceso, el de su selector. */
  angleFormat: AngleInputFormat;
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
        const base = inputOf(draftOf(process, stations), null);
        const { result, order, angleType } = computePolygonalDetected(base);
        const input: PolygonalInput = { ...base, order: order ?? "ordinario", angleType };
        const amarre = referencePoints.find((p) => p.id === process.reference_point_id);
        const reference =
          amarre && amarre.north !== null && amarre.east !== null
            ? { code: amarre.code, north: Number(amarre.north), east: Number(amarre.east) }
            : null;
        const referenceLabel = amarre?.code ?? process.reference_point_code ?? null;
        return {
          kind: "polygonal",
          entry,
          data: {
            process,
            stations,
            plot: { input, result, reference },
            rows: captureRows(input, {
              start: process.start_point_code,
              reference: referenceLabel,
              end: process.end_point_code,
            }),
            breakdown: correctionBreakdown(input, result),
            order,
            angleType,
            referenceLabel,
            angleFormat: process.angle_input_format,
          },
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
    // La poligonal no se cierra (Fase 35).
    case "polygonal":
      return { closedAt: null, closedBy: null };
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
