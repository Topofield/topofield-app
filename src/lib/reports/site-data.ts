// Los datos del informe sencillo de un lugar (Fase 37, decisión 21): las
// visitas calculadas con su verificación y su nota, el veredicto de la última
// y los avisos de tendencia. Puro: lo usan la sección del informe y las
// pruebas.

import { computeHistory, detectTrendDeviations } from "@/lib/calculations/settlement";
import { nextAccumulatedThreshold, summarizeSite } from "@/lib/calculations/settlement-summary";
import { formatSignedMm } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS, PRECISION_ORDERS, type PrecisionOrder } from "@/types/project";
import {
  ALERT_LEVEL_LABELS,
  type AlertLevel,
  type PointInput,
  type ReadingInput,
  type SettlementHistory,
  type Thresholds,
} from "@/types/settlement";

/** Una visita del lugar, como la necesita el informe. */
export interface SiteReportVisit {
  id: string;
  visitNumber: number;
  date: string;
  status: string;
  /** El orden de su tramo peor; null si alguno no se verifica. */
  precisionOrder: PrecisionOrder | null;
  notes: string | null;
  readings: ReadingInput[];
}

export interface SiteVisitRow {
  visitId: string;
  visitNumber: number;
  date: string;
  mean: number | null;
  maxSettlement: { code: string; value: number } | null;
  maxMove: { code: string; value: number } | null;
  /** «Segundo orden» o «Sin verificación». */
  verification: string;
  worstAlert: AlertLevel;
  /** La primera visita: la línea base. */
  base: boolean;
  note: string | null;
}

export interface SiteReport {
  /** El histórico de las visitas calculadas. */
  history: SettlementHistory;
  rows: SiteVisitRow[];
  last: {
    visitNumber: number;
    points: { code: string; accumulated: number | null; velocity: number | null; alert: AlertLevel }[];
  } | null;
  /** Las frases del veredicto, sobre la última visita. */
  verdict: string[];
  /** Si las visitas se verifican; null sin visitas. */
  verification: string | null;
  notes: { visitNumber: number; date: string; text: string }[];
  warnings: string[];
  /** Las visitas en medición, que no entran hasta terminarse. */
  inProgress: number[];
}

const LEVEL_NAMES: Record<Exclude<AlertLevel, "normal">, string> = {
  caution: "precaución",
  alert: "alerta",
  alarm: "alarma",
};

const byCode = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });

/** «A», «A y B», «A, B y C». */
function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`;
}

const mm = (v: number) => Math.abs(v).toFixed(1);

export function siteReportOf({
  thresholds,
  points,
  visits,
}: {
  thresholds: Thresholds;
  points: PointInput[];
  visits: SiteReportVisit[];
}): SiteReport {
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date) || a.visitNumber - b.visitNumber);
  const calculated = ordered.filter((v) => v.status === "calculated");
  const inProgress = ordered.filter((v) => v.status === "in_progress").map((v) => v.visitNumber);
  const history = computeHistory(
    points,
    calculated.map((v) => ({ id: v.id, visitNumber: v.visitNumber, date: v.date, readings: v.readings })),
    thresholds,
  );
  const summary = summarizeSite(history);
  const code = (pointId: string) => points.find((p) => p.id === pointId)?.code ?? "—";
  const withCode = (v: { pointId: string; value: number } | null) => (v ? { code: code(v.pointId), value: v.value } : null);
  const meta = new Map(calculated.map((v) => [v.id, v]));

  const rows: SiteVisitRow[] = summary.visits.map((s, i) => {
    const v = meta.get(s.visitId)!;
    return {
      visitId: s.visitId,
      visitNumber: s.visitNumber,
      date: s.date,
      mean: s.mean,
      maxSettlement: withCode(s.maxSettlement),
      maxMove: withCode(s.maxMove),
      verification: v.precisionOrder ? PRECISION_ORDER_LABELS[v.precisionOrder] : "Sin verificación",
      worstAlert: s.worstAlert,
      base: i === 0,
      note: v.notes?.trim() || null,
    };
  });

  const lastResult = history.visits.at(-1);
  const last = lastResult
    ? {
        visitNumber: lastResult.visitNumber,
        points: lastResult.readings
          .map((r) => ({
            code: code(r.pointId),
            accumulated: r.accumulatedSettlement,
            velocity: r.velocity,
            alert: r.alertStatus,
          }))
          .sort((a, b) => byCode(a.code, b.code)),
      }
    : null;

  // El veredicto: la peor alerta de la última visita y el mayor acumulado.
  const verdict: string[] = [];
  if (lastResult) {
    const worst = lastResult.worstAlert;
    if (worst === "normal") {
      verdict.push(`En la visita ${lastResult.visitNumber} ningún punto llega a un umbral.`);
    } else {
      const codes = lastResult.readings.filter((r) => r.alertStatus === worst).map((r) => code(r.pointId)).sort(byCode);
      verdict.push(`En la visita ${lastResult.visitNumber} la peor alerta es ${ALERT_LEVEL_LABELS[worst]}: ${list(codes)}.`);
    }
    const max = summary.latest?.maxSettlement;
    if (max && max.value !== 0) {
      const tied = lastResult.readings
        .filter((r) => r.accumulatedSettlement != null && Math.abs(r.accumulatedSettlement - max.value) < 0.05)
        .map((r) => code(r.pointId))
        .sort(byCode);
      const sign = max.value < 0 ? "-" : "+";
      const step = nextAccumulatedThreshold(max.value, {
        caution: thresholds.accumulatedCaution,
        alert: thresholds.accumulatedAlert,
        alarm: thresholds.accumulatedAlarm,
      });
      const where =
        step.kind === "below"
          ? `a ${step.remainingMm.toFixed(1)} mm de la ${LEVEL_NAMES[step.level]} (${sign}${step.thresholdMm} mm)`
          : `más allá de la alarma (${sign}${step.thresholdMm} mm)`;
      verdict.push(`El mayor asentamiento acumulado es ${formatSignedMm(max.value)} mm, en ${list(tied)}, ${where}.`);
    }
  }

  // La verificación: la de cada visita es la de su tramo peor (decisión 15).
  const verified = calculated.filter((v) => v.precisionOrder != null);
  let verification: string | null = null;
  if (calculated.length > 0) {
    if (verified.length === calculated.length) {
      const lowest = verified
        .map((v) => v.precisionOrder!)
        .sort((a, b) => PRECISION_ORDERS.indexOf(b) - PRECISION_ORDERS.indexOf(a))[0]!;
      verification = `Todas las visitas se verifican; la de menor orden alcanza el ${PRECISION_ORDER_LABELS[lowest].toLowerCase()}.`;
    } else if (verified.length === 0) {
      verification = "Ninguna visita se verifica: las cotas son las de la medida, sin un cierre que las compruebe.";
    } else {
      verification = `${verified.length} de ${calculated.length} visitas se verifican; las demás no cierran en un BM del lugar o no alcanzan un orden.`;
    }
  }

  // Los avisos de tendencia (Fase 12), con el margen fijo (decisión 17).
  const deviations = detectTrendDeviations(history.visits);
  const warnings = history.visits.flatMap((v, i) => {
    const byPoint = deviations.get(v.visitId);
    if (!byPoint) return [];
    return [...byPoint.values()]
      .map((d) => {
        const previous = history.visits
          .slice(0, i)
          .reverse()
          .find((p) => p.readings.some((r) => r.pointId === d.pointId));
        const verb = d.partialMm > 0 ? "subió" : "bajó";
        const from = previous ? ` desde la visita ${previous.visitNumber}` : "";
        const head = `${code(d.pointId)} · visita ${v.visitNumber}: ${verb} ${mm(d.partialMm)} mm${from}`;
        return d.kind === "excessive"
          ? `${head}; a su ritmo anterior serían unos ${mm(d.expectedMm)} mm.`
          : `${head}, contra su tendencia.`;
      })
      .sort(byCode);
  });

  return {
    history,
    rows,
    last,
    verdict,
    verification,
    notes: rows.flatMap((r) => (r.note ? [{ visitNumber: r.visitNumber, date: r.date, text: r.note }] : [])),
    warnings,
    inProgress,
  };
}
