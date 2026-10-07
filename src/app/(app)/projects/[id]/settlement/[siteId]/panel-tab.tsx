import { SitePanel } from "@/components/settlement/site-panel";
import type { VisitTableRow } from "@/components/settlement/visits-table";
import {
  computeHistory,
  detectTrendDeviations,
  pointInputOf,
} from "@/lib/calculations/settlement";
import {
  bookBenchmarkChecks,
  bookRowInputOf,
  bookRowOf,
  computeBook,
} from "@/lib/calculations/settlement-book";
import { summarizeSite } from "@/lib/calculations/settlement-summary";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { formatSignedMm, formatTrendDeviation, settlementPointLabel } from "@/lib/utils/format";
import type {
  getSettlementReadingsBySite,
  getSiteBenchmarks,
  getSiteBooks,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import type { Project } from "@/types/project";
import type { Site } from "@/types/site";
import type { PointInput, VisitInput } from "@/types/settlement";

interface PanelTabProps {
  project: Project;
  site: Site;
  sitePoints: Awaited<ReturnType<typeof getSitePoints>>;
  visits: Awaited<ReturnType<typeof getVisits>>;
  readingsBySite: Awaited<ReturnType<typeof getSettlementReadingsBySite>>;
  /** Las libretas de las visitas, para los BM leídos de paso (Fase 30). */
  booksByVisit: Awaited<ReturnType<typeof getSiteBooks>>;
  benchmarks: Awaited<ReturnType<typeof getSiteBenchmarks>>;
}

/**
 * Pestaña Panel del lugar (Fase 37, lienzo «Lugar B»). El histórico se calcula
 * en el servidor con `computeHistory` —el mismo motor que usan las acciones al
 * guardar—, con los umbrales vigentes: todo en vivo, sin nada cerrado.
 */
export function PanelTab({ project, site, sitePoints, visits, readingsBySite, booksByVisit, benchmarks }: PanelTabProps) {
  const points: PointInput[] = sitePoints.map(pointInputOf);
  const codes = Object.fromEntries(points.map((p) => [p.id, p.code]));
  const benchmarkInputs = benchmarks.map((b) => ({ code: b.code, elevation: b.elevation }));

  const visitInputs: VisitInput[] = visits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({ pointId: r.point_id, elevation: Number(r.elevation) })),
  }));

  const thresholds = thresholdsOf(site);
  const history = computeHistory(points, visitInputs, thresholds);
  const summary = summarizeSite(history);
  const chartThresholds = {
    caution: thresholds.accumulatedCaution,
    alert: thresholds.accumulatedAlert,
    alarm: thresholds.accumulatedAlarm,
  };

  const summaryById = new Map(summary.visits.map((s) => [s.visitId, s]));
  const withCode = (v: { pointId: string; value: number } | null) =>
    v ? { code: codes[v.pointId] ?? "—", value: v.value } : null;
  const rows: VisitTableRow[] = visits.map((visit) => {
    const s = summaryById.get(visit.id);
    // Los BM del lugar leídos de paso que no nivelan (Fase 30).
    const bookRows = (booksByVisit[visit.id] ?? []).map((r) => bookRowInputOf(bookRowOf(r)));
    const notLeveling =
      bookRows.length > 0
        ? bookBenchmarkChecks(computeBook(bookRows, benchmarkInputs), bookRows, benchmarkInputs, points).filter(
            (check) => check.meetsTolerance === false,
          )
        : [];
    return {
      visitId: visit.id,
      visitNumber: visit.visit_number,
      date: visit.date,
      status: visit.status,
      mean: s?.mean ?? null,
      maxSettlement: withCode(s?.maxSettlement ?? null),
      maxMove: withCode(s?.maxMove ?? null),
      bmWarning:
        notLeveling.length > 0
          ? `${notLeveling.map((c) => `${c.code} ${formatSignedMm(c.differenceMm)} mm`).join(" y ")} de su cota en los BM del lugar`
          : null,
      worstAlert: s?.worstAlert ?? "normal",
    };
  });

  // Los avisos de tendencia de todas las visitas (Fase 12), con el margen fijo.
  const numberOf = new Map(visits.map((v) => [v.id, v.visit_number]));
  const warnings = [...detectTrendDeviations(history.visits).entries()].flatMap(([visitId, byPoint]) =>
    [...byPoint.entries()].map(([pointId, deviation]) => ({
      id: `${visitId}:${pointId}`,
      title: `${codes[pointId] ?? "—"} · visita ${numberOf.get(visitId) ?? "?"}`,
      text: formatTrendDeviation(deviation),
    })),
  );

  const trendVisits = summary.visits.map((s) => ({
    visitId: s.visitId,
    label: s.visitNumber === 0 ? "Visita 0 (base)" : `Visita ${s.visitNumber}`,
    date: s.date,
    mean: s.mean,
    min: s.min,
    max: s.max,
  }));
  const scatterSeries = [...points]
    .sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }))
    .map((p) => ({
      pointId: p.id,
      label: settlementPointLabel(p),
      values: history.visits.flatMap((v) => {
        const r = v.readings.find((x) => x.pointId === p.id);
        return r?.accumulatedSettlement != null ? [{ date: v.date, value: r.accumulatedSettlement }] : [];
      }),
    }))
    .filter((s) => s.values.length > 0);

  // La última visita en una línea: cuántos puntos normales y los más asentados.
  const lastReadings = history.visits.at(-1)?.readings ?? [];
  const normals = lastReadings.filter((r) => r.alertStatus === "normal").length;
  const mostSettled = [...lastReadings]
    .filter((r) => r.accumulatedSettlement != null)
    .sort((a, b) => a.accumulatedSettlement! - b.accumulatedSettlement!)
    .slice(0, 3)
    .map((r) => `${codes[r.pointId] ?? "—"} ${formatSignedMm(r.accumulatedSettlement)}`);
  const lastVisitNote =
    lastReadings.length > 0
      ? `${normals} de ${lastReadings.length} normales en la última visita · más asentados: ${mostSettled.join(" · ")}`
      : null;

  return (
    <SitePanel
      summary={summary}
      codes={codes}
      thresholds={thresholds}
      rows={rows}
      hrefBase={`/projects/${project.id}/settlement/${site.id}/visits`}
      trendVisits={trendVisits}
      scatterSeries={scatterSeries}
      chartThresholds={chartThresholds}
      warnings={warnings}
      lastVisitNote={lastVisitNote}
    />
  );
}
