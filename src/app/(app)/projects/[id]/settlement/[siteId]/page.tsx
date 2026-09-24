import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumbs,
  buttonClasses,
  Card,
  EmptyState,
} from "@/components/design-system";
import { AnalysisPanel } from "@/components/settlement/analysis-panel";
import { ThresholdSwatch } from "@/components/settlement/charts/chart-parts";
import { PointsScatter } from "@/components/settlement/charts/points-scatter";
import { NewVisitDialog } from "@/components/settlement/new-visit-dialog";
import { SiteKpis } from "@/components/settlement/site-kpis";
import { SiteTrend } from "@/components/settlement/site-trend";
import { VisitsTable, type VisitTableRow } from "@/components/settlement/visits-table";
import { createClient } from "@/lib/supabase/server";
import {
  computeHistory,
  detectTrendDeviations,
  isPointActiveOn,
  pointInputOf,
} from "@/lib/calculations/settlement";
import { summarizeSite } from "@/lib/calculations/settlement-summary";
import {
  formatDateOnly,
  formatTrendDeviation,
  settlementPointLabel,
} from "@/lib/utils/format";
import {
  getProjectById,
  getReferencePoints,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import type { PointInput, VisitInput } from "@/types/settlement";

interface SettlementAnalysisPageProps {
  params: Promise<{ id: string; siteId: string }>;
}

/**
 * Panel del control de asentamientos de un lugar (Fase 18, layout del
 * prototipo): KPIs, visitas, tendencia, evolución por punto, semáforo de la
 * última visita y diferenciales. El histórico se calcula aquí, en el
 * servidor, con `computeHistory` — el mismo motor que usan las Server Actions
 * al guardar, para que lo que se ve coincida siempre con lo persistido.
 */
export default async function SettlementAnalysisPage({
  params,
}: SettlementAnalysisPageProps) {
  const { id, siteId } = await params;

  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) {
    notFound();
  }

  const [sitePoints, visits, readingsBySite, referencePoints] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
    getReferencePoints(supabase, project.id),
  ]);

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

  // Aviso de lectura fuera de tendencia de la última visita (Fase 12). El
  // margen sale del orden que declaró cada visita.
  const lastVisitId = history.visits.at(-1)?.visitId;
  const deviations = detectTrendDeviations(
    history.visits,
    new Map(visits.map((v) => [v.id, v.precision_order])),
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

  const activeCount = points.filter((p) =>
    isPointActiveOn(p, new Date().toISOString().slice(0, 10)),
  ).length;
  const hasReadings = history.visits.some((v) => v.readings.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name, href: `/projects/${project.id}/sites/${site.id}` },
          { label: "Análisis" },
        ]}
      />
      <header className="flex flex-col gap-3 border-b-2 border-neutral-900 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Control de asentamientos en {activeCount} puntos de control.
            {summary.baseDate && ` Lectura base el ${formatDateOnly(summary.baseDate)}.`}
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
            <li className="flex items-center gap-1.5">
              <ThresholdSwatch level="caution" /> Precaución −{chartThresholds.caution} mm
            </li>
            <li className="flex items-center gap-1.5">
              <ThresholdSwatch level="alert" /> Alerta −{chartThresholds.alert} mm
            </li>
            <li className="flex items-center gap-1.5">
              <ThresholdSwatch level="alarm" /> Alarma −{chartThresholds.alarm} mm
            </li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {site.status !== "closed" && (
            <NewVisitDialog
              projectId={project.id}
              siteId={site.id}
              referencePoints={referencePoints}
              previous={visits.at(-1) ?? null}
            />
          )}
          <a
            href={`/projects/${project.id}/settlement/${site.id}/export`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
            download
          >
            Exportar a Excel
          </a>
          <Link
            href={`/projects/${project.id}/sites/${site.id}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Editar lugar
          </Link>
        </div>
      </header>

      <SiteKpis summary={summary} codes={codes} distortionLimit={thresholds.angularDistortionLimit} />

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
        differentials={history.differentials}
        trends={history.trends}
        lastVisitTrendWarnings={lastVisitTrendWarnings}
      />
    </div>
  );
}
