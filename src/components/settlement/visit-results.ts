// Los números del paso 2 · Resultados de una visita (Fase 37, decisión 20):
// la franja de indicadores y una fila por punto, con su tendencia. Sin «use
// client»: lo usan la página y las pruebas.
import { computeTrends, daysBetween } from "@/lib/calculations/settlement";
import { summarizeSite } from "@/lib/calculations/settlement-summary";
import type { AlertLevel, PointInput, Trend, VisitResult } from "@/types/settlement";

export interface VisitResults {
  /** El acumulado de mayor valor absoluto y los puntos que lo tienen. */
  max: { value: number; codes: string[] } | null;
  /** El promedio de la visita y su cambio frente a la anterior. */
  mean: { value: number; change: number | null; previousNumber: number | null } | null;
  /** El parcial de mayor valor absoluto, sus puntos y los días desde la anterior. */
  move: { value: number; codes: string[]; days: number | null } | null;
  /** La peor alerta y cuántos puntos están en precaución o más. */
  alert: { level: AlertLevel; count: number; total: number };
  rows: {
    pointId: string;
    code: string;
    elevation: number;
    partial: number | null;
    accumulated: number | null;
    velocity: number | null;
    alert: AlertLevel;
    /** Con tres lecturas del punto; null si no las tiene. */
    trend: Trend | null;
  }[];
}

const byCode = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });
const tie = (a: number, b: number) => Math.abs(a - b) < 0.05;

export function visitResultsOf(visits: readonly VisitResult[], visitId: string, points: readonly PointInput[]): VisitResults {
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
  const at = ordered.findIndex((v) => v.visitId === visitId);
  const visit = ordered[at];
  if (!visit || visit.readings.length === 0) {
    return { max: null, mean: null, move: null, alert: { level: "normal", count: 0, total: 0 }, rows: [] };
  }
  const code = (id: string) => points.find((p) => p.id === id)?.code ?? "—";
  const summary = summarizeSite({ visits: ordered.slice(0, at + 1) });
  const current = summary.visits.at(-1)!;
  const previous = at > 0 ? summary.visits.at(-2)! : null;
  const trends = computeTrends(ordered.slice(0, at + 1));
  const codesWith = (value: number, pick: (r: VisitResult["readings"][number]) => number | null) =>
    visit.readings
      .filter((r) => {
        const v = pick(r);
        return v != null && tie(v, value);
      })
      .map((r) => code(r.pointId))
      .sort(byCode);

  return {
    max: current.maxSettlement
      ? { value: current.maxSettlement.value, codes: codesWith(current.maxSettlement.value, (r) => r.accumulatedSettlement) }
      : null,
    mean:
      current.mean == null
        ? null
        : {
            value: current.mean,
            change: previous?.mean != null ? current.mean - previous.mean : null,
            previousNumber: previous?.visitNumber ?? null,
          },
    move: current.maxMove
      ? {
          value: current.maxMove.value,
          codes: codesWith(current.maxMove.value, (r) => r.partialSettlement),
          days: previous ? daysBetween(previous.date, visit.date) : null,
        }
      : null,
    alert: { level: current.worstAlert, count: current.alertCount, total: visit.readings.length },
    rows: visit.readings
      .map((r) => ({
        pointId: r.pointId,
        code: code(r.pointId),
        elevation: r.elevation,
        partial: r.partialSettlement,
        accumulated: r.accumulatedSettlement,
        velocity: r.velocity,
        alert: r.alertStatus,
        trend: r.partialSettlement == null ? null : (trends[r.pointId] ?? null),
      }))
      .sort((a, b) => byCode(a.code, b.code)),
  };
}
