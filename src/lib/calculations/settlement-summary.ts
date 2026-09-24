// Resúmenes (KPIs) del control de asentamientos (Fase 18).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// Todo sale del resultado de `computeHistory`: estos KPIs no calculan
// asentamientos, los resumen. Dos del prototipo se sustituyen a propósito (PRD
// de la Fase 18, «KPIs»): la «velocidad reciente» dividía el cambio del
// promedio de cuatro visitas entre «un mes», que solo vale si las visitas son
// semanales —el mismo error que la Fase 5 encontró en el marco teórico—, y el
// «diferencial máximo» ignoraba la distancia entre puntos. Aquí se usan la
// velocidad del motor (mes = 30.4375 d) y la peor distorsión angular.

import { ALERT_LEVELS } from "@/types/settlement";
import type {
  AlertLevel,
  ComputedReading,
  DifferentialPair,
  SettlementHistory,
  VisitResult,
} from "@/types/settlement";

/** Un valor con el punto que lo tiene. */
export interface PointValue {
  pointId: string;
  value: number;
}

export interface VisitSummary {
  visitId: string;
  visitNumber: number;
  date: string;
  readingCount: number;
  /** El acumulado de mayor valor absoluto, CON su signo: un levantamiento también es un hallazgo. */
  maxSettlement: PointValue | null;
  /** Media de los acumulados de la visita. */
  mean: number | null;
  /** Menor y mayor acumulado: la banda de la tendencia. */
  min: number | null;
  max: number | null;
  /** El parcial de mayor valor absoluto. */
  maxMove: PointValue | null;
  /** La velocidad de mayor valor absoluto, en mm/mes. */
  maxVelocity: PointValue | null;
  /** Lecturas con nivel ≥ precaución. */
  alertCount: number;
  worstAlert: AlertLevel;
}

export interface SiteSummary {
  /** Una por visita, en orden cronológico. */
  visits: VisitSummary[];
  latest: VisitSummary | null;
  /** Fecha de la lectura base (la primera visita) y del último registro. */
  baseDate: string | null;
  lastDate: string | null;
  /** Visitas cuyo peor nivel es ≥ precaución. */
  visitsInAlert: number;
  /**
   * El par con la peor distorsión angular de la última visita (el menor X de
   * 1/X). Puede ser `Infinity` si todos los pares se asientan igual.
   */
  worstDistortion: DifferentialPair | null;
}

/** El valor de mayor magnitud entre las lecturas que lo tienen. */
function largest(
  readings: ComputedReading[],
  pick: (r: ComputedReading) => number | null,
): PointValue | null {
  let best: PointValue | null = null;
  for (const r of readings) {
    const value = pick(r);
    if (value == null) continue;
    if (best == null || Math.abs(value) > Math.abs(best.value)) {
      best = { pointId: r.pointId, value };
    }
  }
  return best;
}

export function summarizeVisit(visit: VisitResult): VisitSummary {
  const accumulated = visit.readings
    .map((r) => r.accumulatedSettlement)
    .filter((x): x is number => x != null);
  const cautionIndex = ALERT_LEVELS.indexOf("caution");

  return {
    visitId: visit.visitId,
    visitNumber: visit.visitNumber,
    date: visit.date,
    readingCount: visit.readings.length,
    maxSettlement: largest(visit.readings, (r) => r.accumulatedSettlement),
    mean:
      accumulated.length > 0
        ? accumulated.reduce((a, b) => a + b, 0) / accumulated.length
        : null,
    min: accumulated.length > 0 ? Math.min(...accumulated) : null,
    max: accumulated.length > 0 ? Math.max(...accumulated) : null,
    maxMove: largest(visit.readings, (r) => r.partialSettlement),
    maxVelocity: largest(visit.readings, (r) => r.velocity),
    alertCount: visit.readings.filter(
      (r) => ALERT_LEVELS.indexOf(r.alertStatus) >= cautionIndex,
    ).length,
    worstAlert: visit.worstAlert,
  };
}

export function summarizeSite(history: SettlementHistory): SiteSummary {
  const visits = history.visits.map(summarizeVisit);
  const worstDistortion = history.differentials.reduce<DifferentialPair | null>(
    (worst, p) =>
      worst == null || p.distortionInverse < worst.distortionInverse ? p : worst,
    null,
  );
  return {
    visits,
    latest: visits.at(-1) ?? null,
    baseDate: visits[0]?.date ?? null,
    lastDate: visits.at(-1)?.date ?? null,
    visitsInAlert: visits.filter((v) => v.worstAlert !== "normal").length,
    worstDistortion,
  };
}
