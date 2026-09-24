import { Breadcrumbs } from "@/components/design-system";
import { VisitView, type VisitPointRow } from "@/components/settlement/visit-view";
import {
  computeHistory,
  detectTrendDeviations,
  isPointActiveOn,
  pointInputOf,
} from "@/lib/calculations/settlement";
import {
  bookRowInputOf,
  bookRowOf,
  computeVisitBook,
} from "@/lib/calculations/settlement-book";
import { summarizeVisit } from "@/lib/calculations/settlement-summary";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import {
  formatDateShort,
  formatEquipmentLine,
  formatTrendDeviation,
  settlementPointLabel,
} from "@/lib/utils/format";
import { loadVisitData } from "./visit-data";

interface VisitPageProps {
  params: Promise<{ id: string; siteId: string; visitId: string }>;
}

/**
 * La vista de una visita (Fase 18, decisión 14): el layout del prototipo, en
 * lectura, para toda visita. Se edita en `/editar`. El histórico se calcula
 * aquí con el mismo motor que usan las Server Actions al guardar.
 */
export default async function VisitPage({ params }: VisitPageProps) {
  const { id, siteId, visitId } = await params;
  const data = await loadVisitData(id, siteId, visitId);
  const { project, site, visit, allVisits } = data;

  const siteHref = `/projects/${project.id}/settlement/${site.id}`;
  const viewHref = `${siteHref}/visits/${visit.id}`;
  const thresholds = thresholdsOf(site);
  const points = data.points.map(pointInputOf);
  const history = computeHistory(points, data.visitInputs, thresholds);

  const index = history.visits.findIndex((v) => v.visitId === visit.id);
  const result = history.visits[index]!;
  const summary = summarizeVisit(result);
  const previous = index > 0 ? summarizeVisit(history.visits[index - 1]!) : null;

  const deviations =
    detectTrendDeviations(
      history.visits,
      new Map(allVisits.map((v) => [v.id, v.precision_order])),
    ).get(visit.id) ?? new Map();

  const sorted = [...points].sort((a, b) =>
    a.code.localeCompare(b.code, "es", { numeric: true }),
  );
  const rows: VisitPointRow[] = sorted
    .map((p, seriesIndex) => {
      const r = result.readings.find((x) => x.pointId === p.id) ?? null;
      return { p, r, seriesIndex };
    })
    // Los puntos vigentes en la fecha, más los que tienen lectura (Fase 11).
    .filter(({ p, r }) => r != null || isPointActiveOn(p, visit.date))
    .map(({ p, r, seriesIndex }) => {
      const deviation = deviations.get(p.id);
      return {
        pointId: p.id,
        code: p.code,
        label: settlementPointLabel(p),
        note:
          p.retiredOn !== null
            ? "de baja"
            : p.activeFrom !== null
              ? `alta ${formatDateShort(p.activeFrom)}`
              : null,
        seriesIndex,
        baselineElevation: r?.baselineElevation ?? p.initialElevation,
        elevation: r?.elevation ?? null,
        accumulated: r?.accumulatedSettlement ?? null,
        partial: r?.partialSettlement ?? null,
        velocity: r?.velocity ?? null,
        level: r?.alertStatus ?? null,
        trendWarning: deviation ? formatTrendDeviation(deviation) : null,
        history: history.visits.slice(0, index + 1).flatMap((v) => {
          const x = v.readings.find((y) => y.pointId === p.id);
          return x?.accumulatedSettlement != null
            ? [{ date: v.date, value: x.accumulatedSettlement }]
            : [];
        }),
      };
    });

  // La comprobación aritmética de la libreta guardada, para el diálogo de
  // cierre: bloquea si falla (Fase 18, decisión 5).
  const amarreElevation =
    visit.reference_bm_elevation == null ? null : Number(visit.reference_bm_elevation);
  const arithmeticCheckOk =
    visit.capture_mode === "book" && data.book.length > 0 && amarreElevation != null
      ? computeVisitBook(
          data.book.map((r) => bookRowInputOf(bookRowOf(r))),
          amarreElevation,
          visit.precision_order,
        ).arithmeticCheckOk
      : null;

  const prev = index > 0 ? allVisits[index - 1] : null;
  const next = allVisits[index + 1] ?? null;
  const open = site.status !== "closed" && visit.status !== "closed";
  const visitLabel = `Visita ${visit.visit_number}`;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name, href: siteHref },
          { label: visitLabel },
        ]}
      />
      <VisitView
        projectId={project.id}
        siteId={site.id}
        visitId={visit.id}
        visitLabel={visitLabel}
        isBaseline={index === 0}
        date={visit.date}
        operator={visit.operator}
        equipment={formatEquipmentLine(visit.equipment_brand, visit.equipment_model)}
        status={visit.status}
        captureMode={visit.capture_mode}
        amarre={
          visit.reference_bm_code
            ? { code: visit.reference_bm_code, elevation: amarreElevation }
            : null
        }
        closureErrorMm={visit.closure_error_mm == null ? null : Number(visit.closure_error_mm)}
        toleranceMm={visit.tolerance_mm == null ? null : Number(visit.tolerance_mm)}
        meetsTolerance={visit.meets_tolerance}
        arithmeticCheckOk={arithmeticCheckOk}
        summary={summary}
        previousMean={previous?.mean ?? null}
        rows={rows}
        thresholds={{
          caution: thresholds.accumulatedCaution,
          alert: thresholds.accumulatedAlert,
          alarm: thresholds.accumulatedAlarm,
        }}
        book={data.book}
        prevHref={prev ? `${siteHref}/visits/${prev.id}` : null}
        nextHref={next ? `${siteHref}/visits/${next.id}` : null}
        editHref={open ? `${viewHref}/editar` : null}
        backHref={siteHref}
        siteName={site.name}
      />
    </div>
  );
}
