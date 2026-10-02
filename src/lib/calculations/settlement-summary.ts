// Resúmenes (KPIs) del control de asentamientos (Fase 18).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// Todo sale del resultado de `computeHistory`: estos KPIs no calculan
// asentamientos, los resumen. La «velocidad reciente» del prototipo se
// sustituye a propósito (PRD de la Fase 18, «KPIs»): dividía el cambio del
// promedio de cuatro visitas entre «un mes», que solo vale si las visitas son
// semanales —el mismo error que la Fase 5 encontró en el marco teórico—. Aquí
// se usa la velocidad del motor (mes = 30.4375 d). Su «diferencial máximo» no
// está: los puntos de control no tienen posición (Fase 29).

import { ALERT_LEVELS } from "@/types/settlement";
import type {
  AlertLevel,
  ComputedReading,
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
  /**
   * El promedio de la visita. En `summarizeSite`, el encadenado (Fase 31,
   * D-8, ver `chainedMeans`); `summarizeVisit`, que no conoce las visitas
   * anteriores, da la media de los acumulados.
   */
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

/**
 * El promedio de asentamientos de cada visita, **encadenado** (Fase 31, D-8):
 * el de la visita anterior con lecturas más la media de (cota − cota anterior)
 * × 1000 de los puntos medidos en las dos.
 *
 * La media de los acumulados mezcla líneas base: un punto dado de alta entra
 * con acumulado 0 y tira del promedio hacia arriba, y uno dado de baja se lo
 * lleva. Encadenado, el promedio solo se mueve con lo que se asientan los
 * puntos medidos en las dos visitas. Sin altas ni bajas da lo mismo que la
 * media.
 *
 * - La primera visita con lecturas arranca en la media de sus acumulados (no
 *   es cero si la C0 viene de otra medición).
 * - Una visita sin lecturas no tiene promedio, y la siguiente se encadena con
 *   la anterior que sí tenía.
 * - Sin ningún punto en común con la anterior, no hay parcial que promediar:
 *   la cadena se reinicia con la media de los acumulados.
 */
export function chainedMeans(visits: VisitResult[]): (number | null)[] {
  const average = (values: number[]) =>
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  const means: (number | null)[] = [];
  let previous: VisitResult | null = null;
  let previousMean: number | null = null;
  for (const visit of visits) {
    if (visit.readings.length === 0) {
      means.push(null);
      continue;
    }
    let mean = average(
      visit.readings
        .map((r) => r.accumulatedSettlement)
        .filter((x): x is number => x != null),
    );
    if (previous && previousMean != null) {
      const before = new Map(previous.readings.map((r) => [r.pointId, r.elevation]));
      const partials = visit.readings.flatMap((r) => {
        const elevation = before.get(r.pointId);
        return elevation === undefined ? [] : [(r.elevation - elevation) * 1000];
      });
      const step = average(partials);
      if (step != null) mean = previousMean + step;
    }
    means.push(mean);
    previous = visit;
    previousMean = mean;
  }
  return means;
}

export function summarizeSite(history: SettlementHistory): SiteSummary {
  const means = chainedMeans(history.visits);
  const visits = history.visits.map((visit, i) => ({
    ...summarizeVisit(visit),
    mean: means[i] ?? null,
  }));
  return {
    visits,
    latest: visits.at(-1) ?? null,
    baseDate: visits[0]?.date ?? null,
    lastDate: visits.at(-1)?.date ?? null,
    visitsInAlert: visits.filter((v) => v.worstAlert !== "normal").length,
  };
}

export type ThresholdStep =
  | { kind: "below"; level: "caution" | "alert" | "alarm"; thresholdMm: number; remainingMm: number }
  | { kind: "beyondAlarm"; thresholdMm: number };

/**
 * Cuánto le falta al acumulado de un punto para el siguiente umbral de
 * acumulado del lugar, o si ya pasó el de alarma (la nota del historial del
 * punto, Fase 18). Se mide en valor absoluto, como `classifyAlert`: un
 * levantamiento también se acerca a los umbrales. La frontera cuenta como
 * alcanzada (`>=`), igual que en la clasificación.
 */
export function nextAccumulatedThreshold(
  accumulatedMm: number,
  thresholds: { caution: number; alert: number; alarm: number },
): ThresholdStep {
  const magnitude = Math.abs(accumulatedMm);
  const steps = [
    ["caution", thresholds.caution],
    ["alert", thresholds.alert],
    ["alarm", thresholds.alarm],
  ] as const;
  for (const [level, value] of steps) {
    if (magnitude < value) {
      return { kind: "below", level, thresholdMm: value, remainingMm: value - magnitude };
    }
  }
  return { kind: "beyondAlarm", thresholdMm: thresholds.alarm };
}
