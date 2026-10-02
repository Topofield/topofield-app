import { Card, EmptyState } from "@/components/design-system";
import { AnalysisPanel } from "@/components/settlement/analysis-panel";
import { ThresholdSwatch } from "@/components/settlement/charts/chart-parts";
import { PointsScatter } from "@/components/settlement/charts/points-scatter";
import { SiteKpis } from "@/components/settlement/site-kpis";
import { SiteTrend } from "@/components/settlement/site-trend";
import { VisitsTable, type VisitTableRow } from "@/components/settlement/visits-table";
import {
  computeHistory,
  computeTrends,
  detectTrendDeviations,
  pointInputOf,
} from "@/lib/calculations/settlement";
import { benchmarkChecksOfBook } from "@/lib/calculations/settlement-book";
import { summarizeSite } from "@/lib/calculations/settlement-summary";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { formatTrendDeviation, settlementPointLabel } from "@/lib/utils/format";
import type {
  getSettlementReadingsBySite,
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
  /** Las libretas de las visitas, para la comprobación de los BM (Fase 30). */
  booksByVisit: Awaited<ReturnType<typeof getSiteBooks>>;
}

/**
 * Pestaña Panel del control de asentamientos (Fase 18, layout del prototipo;
 * pestaña desde la Fase 22): umbrales, KPIs, visitas, tendencia, evolución
 * por punto y semáforo de la última visita. El histórico se
 * calcula en el servidor con `computeHistory` —el mismo motor que usan las
 * Server Actions al guardar—, con los umbrales vigentes: una visita cerrada se
 * reclasifica si se editan los umbrales. Sus lecturas no cambian, porque una
 * visita solo se cierra con las anteriores cerradas (Fase 26, C-15).
 */
export function PanelTab({ project, site, sitePoints, visits, readingsBySite, booksByVisit }: PanelTabProps) {
  const points: PointInput[] = sitePoints.map(pointInputOf);
  const codes = Object.fromEntries(points.map((p) => [p.id, p.code]));

  const visitInputs: VisitInput[] = visits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({
      pointId: r.point_id,
      elevation: Number(r.elevation),
    })),
  }));

  const thresholds = thresholdsOf(site);
  const history = computeHistory(points, visitInputs, thresholds);
  const summary = summarizeSite(history);
  const chartThresholds = {
    caution: thresholds.accumulatedCaution,
    alert: thresholds.accumulatedAlert,
    alarm: thresholds.accumulatedAlarm,
  };

  // Aviso de lectura fuera de tendencia de la última visita (Fase 12) y
  // tendencia de cada punto (Fase 31): los dos márgenes salen del orden que
  // declaró cada visita.
  const orderByVisit = new Map(visits.map((v) => [v.id, v.precision_order]));
  const trends = computeTrends(history.visits, orderByVisit);
  const lastVisitId = history.visits.at(-1)?.visitId;
  const deviations = detectTrendDeviations(
    history.visits,
    orderByVisit,
  );
  const lastVisitTrendWarnings = Object.fromEntries(
    [...(lastVisitId ? (deviations.get(lastVisitId) ?? []) : [])].map(
      ([pointId, deviation]) => [pointId, formatTrendDeviation(deviation)],
    ),
  );

  const summaryById = new Map(summary.visits.map((s) => [s.visitId, s]));
  const withCode = (v: { pointId: string; value: number } | null) =>
    v ? { code: codes[v.pointId] ?? "—", value: v.value } : null;
  const visitRows: VisitTableRow[] = visits.map((visit) => {
    const s = summaryById.get(visit.id);
    // Los BM de control que no nivelan con el amarre (Fase 30).
    const notLeveling =
      visit.capture_mode === "book"
        ? benchmarkChecksOfBook(booksByVisit[visit.id] ?? [], visit.precision_order).filter(
            (check) => check.meetsTolerance === false,
          )
        : [];
    return {
      visitId: visit.id,
      visitNumber: visit.visit_number,
      date: visit.date,
      status: visit.status,
      captureMode: visit.capture_mode,
      mean: s?.mean ?? null,
      maxSettlement: withCode(s?.maxSettlement ?? null),
      maxMove: withCode(s?.maxMove ?? null),
      amarre: visit.reference_bm_code
        ? {
            code: visit.reference_bm_code,
            elevation:
              visit.reference_bm_elevation == null ? null : Number(visit.reference_bm_elevation),
          }
        : null,
      closureErrorMm: visit.closure_error_mm == null ? null : Number(visit.closure_error_mm),
      toleranceMm: visit.tolerance_mm == null ? null : Number(visit.tolerance_mm),
      meetsTolerance: visit.meets_tolerance,
      bmWarning:
        notLeveling.length > 0
          ? `${notLeveling.map((check) => check.code).join(" y ")} no nivela con ${visit.reference_bm_code ?? "el amarre"}`
          : null,
      worstAlert: s?.worstAlert ?? "normal",
    };
  });

  const hrefBase = `/projects/${project.id}/settlement/${site.id}/visits`;
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
        return r?.accumulatedSettlement != null
          ? [{ date: v.date, value: r.accumulatedSettlement }]
          : [];
      }),
    }))
    .filter((s) => s.values.length > 0);

  const hasReadings = history.visits.some((v) => v.readings.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <ThresholdSwatch level="caution" /> Precaución -{chartThresholds.caution} mm
        </li>
        <li className="flex items-center gap-1.5">
          <ThresholdSwatch level="alert" /> Alerta -{chartThresholds.alert} mm
        </li>
        <li className="flex items-center gap-1.5">
          <ThresholdSwatch level="alarm" /> Alarma -{chartThresholds.alarm} mm
        </li>
      </ul>

      <SiteKpis summary={summary} codes={codes} />

      <Card
        title="Visitas"
        description="Abre una visita para ver sus puntos de control y su registro de nivelación."
      >
        <VisitsTable rows={visitRows} hrefBase={hrefBase} />
      </Card>

      <Card
        title="Tendencia del asentamiento"
        description="Promedio de los puntos de control en cada visita, con el rango entre el más y el menos asentado."
      >
        {hasReadings ? (
          <SiteTrend visits={trendVisits} thresholds={chartThresholds} hrefBase={hrefBase} />
        ) : (
          <EmptyState
            title="Todavía no hay lecturas"
            description="La tendencia se dibuja con las visitas que ya tienen cotas."
          />
        )}
      </Card>

      <Card
        title="Evolución por punto"
        description="Acumulado de cada punto de control en el tiempo. Elige un punto para resaltarlo."
      >
        {hasReadings && summary.baseDate ? (
          <PointsScatter series={scatterSeries} baseDate={summary.baseDate} thresholds={chartThresholds} />
        ) : (
          <EmptyState
            title="Todavía no hay lecturas"
            description="La gráfica se dibuja con el acumulado de cada visita."
          />
        )}
      </Card>

      <AnalysisPanel
        points={points}
        visits={history.visits}
        trends={trends}
        lastVisitTrendWarnings={lastVisitTrendWarnings}
      />
    </div>
  );
}
