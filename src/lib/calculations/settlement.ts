// Cálculos del control de asentamientos (PRD § 6.10 y § 6.11).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// Las fórmulas de asentamiento parcial, acumulado y distorsión angular se
// verificaron correctas contra los tres casos de estudio del marco teórico
// (35 valores, todos exactos). La VELOCIDAD no: el documento la calcula mal
// por no definir el mes. Ver docs/prds/04-asentamientos.md, hallazgo 2.

import { DAYS_PER_MONTH } from "./tolerances";
import type {
  AlertLevel,
  ComputedReading,
  DifferentialPair,
  PointInput,
  VisitInput,
  VisitResult,
} from "@/types/settlement";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Días de calendario entre dos fechas ISO (`YYYY-MM-DD`).
 *
 * Se parsea como UTC a propósito: `new Date("2025-01-15")` ya es UTC, pero
 * construir la fecha con componentes locales introduciría el desfase de la
 * zona horaria y podría devolver 30.958… días donde hay 31.
 */
export function daysBetween(isoFrom: string, isoTo: string): number {
  const from = Date.parse(`${isoFrom}T00:00:00Z`);
  const to = Date.parse(`${isoTo}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

/** Meses entre dos fechas ISO, con un mes = 30.4375 días (decisión #3). */
export function monthsBetween(isoFrom: string, isoTo: string): number {
  return daysBetween(isoFrom, isoTo) / DAYS_PER_MONTH;
}

/** Redondeo a `decimals` cifras, evitando el −0 que confunde en la UI. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const r = Math.round(value * factor) / factor;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Calcula el asentamiento parcial, el acumulado y la velocidad de cada punto en
 * cada visita.
 *
 * Las visitas se procesan **ordenadas por fecha**, no por `visitNumber`: el
 * número es una etiqueta del usuario y puede no coincidir con la cronología.
 *
 * El parcial y la velocidad de un punto se miden contra la última visita en la
 * que ese punto **sí tuvo lectura**, que no siempre es la visita inmediatamente
 * anterior — un punto puede quedar sin medir en una visita concreta.
 *
 * `alertStatus` sale como `"normal"` de esta función; lo asigna
 * `classifyReadings` una vez conocidos los umbrales del lugar.
 */
export function computeSettlements(
  points: PointInput[],
  visits: VisitInput[],
): VisitResult[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));

  /** Última lectura conocida de cada punto: su cota y la fecha en que se midió. */
  const previous = new Map<string, { elevation: number; date: string }>();

  return ordered.map((visit) => {
    const readings: ComputedReading[] = [];

    for (const reading of visit.readings) {
      const point = byId.get(reading.pointId);
      if (!point) continue;

      const prev = previous.get(reading.pointId);

      let partialSettlement: number | null = null;
      let velocity: number | null = null;

      if (prev) {
        partialSettlement = round((reading.elevation - prev.elevation) * 1000, 1);
        const months = monthsBetween(prev.date, visit.date);
        // Dos visitas el mismo día no definen una velocidad. Devolver null y
        // no Infinity: un «NaN mm» en pantalla ya ocurrió en la Fase 4.
        //
        // La velocidad NO se redondea aquí. Redondear antes de clasificar
        // cambiaría el nivel de alerta: 1.996 mm/mes pasaría a 2.00 y saltaría
        // de `normal` a `caution` cruzando un umbral que en realidad no cruzó.
        // El redondeo pertenece a la persistencia (`velocity DECIMAL(8,2)`) y a
        // la presentación (`.toFixed(2)`), no al motor. El parcial y el
        // acumulado sí se redondean: son diferencias de cotas medidas, donde el
        // decimal extra es ruido de medición y no señal.
        velocity = months === 0 ? null : partialSettlement / months;
      }

      const accumulatedSettlement =
        point.initialElevation === null
          ? null
          : round((reading.elevation - point.initialElevation) * 1000, 1);

      readings.push({
        pointId: reading.pointId,
        elevation: reading.elevation,
        partialSettlement,
        accumulatedSettlement,
        velocity,
        alertStatus: "normal" as AlertLevel,
      });

      previous.set(reading.pointId, {
        elevation: reading.elevation,
        date: visit.date,
      });
    }

    return {
      visitId: visit.id,
      visitNumber: visit.visitNumber,
      date: visit.date,
      readings,
      worstAlert: "normal" as AlertLevel,
    };
  });
}

/**
 * Distancia horizontal entre dos puntos, en metros, desde sus coordenadas N/E.
 * Null si a alguno le faltan coordenadas.
 */
export function horizontalDistance(
  a: PointInput,
  b: PointInput,
): number | null {
  if (
    a.northing === null ||
    a.easting === null ||
    b.northing === null ||
    b.easting === null
  ) {
    return null;
  }
  const dn = a.northing - b.northing;
  const de = a.easting - b.easting;
  return Math.sqrt(dn * dn + de * de);
}

/**
 * Asentamientos diferenciales y distorsión angular de cada par de puntos
 * (§ 6.10), para las lecturas de una visita.
 *
 * La distorsión se expresa como `1/X`, donde `X = (L × 1000) / Δs_diferencial`.
 * Un X MENOR es más severo: 1/300 es peor que 1/500. De ahí que `exceedsLimit`
 * compare `distortionInverse < limit`.
 *
 * Dos exclusiones deliberadas, ambas para no fabricar tranquilidad falsa:
 * - Un par sin coordenadas en algún punto queda fuera. Calcularlo con L = 0
 *   daría distorsión infinita, que se lee como «normal».
 * - Un par donde algún punto no tiene acumulado queda fuera: no hay nada que
 *   comparar.
 *
 * Un diferencial de 0 sí se incluye, con `distortionInverse = Infinity`: dos
 * puntos que se asientan igual no tienen distorsión entre sí, y eso es un
 * resultado legítimo, no un dato ausente.
 */
export function computeDifferentials(
  points: PointInput[],
  readings: ComputedReading[],
  angularDistortionLimit: number,
): DifferentialPair[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const accumulated = new Map(
    readings.map((r) => [r.pointId, r.accumulatedSettlement]),
  );

  const pairs: DifferentialPair[] = [];

  for (let i = 0; i < readings.length; i++) {
    for (let j = i + 1; j < readings.length; j++) {
      const readingA = readings[i];
      const readingB = readings[j];
      if (!readingA || !readingB) continue;

      const idA = readingA.pointId;
      const idB = readingB.pointId;
      const pointA = byId.get(idA);
      const pointB = byId.get(idB);
      if (!pointA || !pointB) continue;

      const accA = accumulated.get(idA);
      const accB = accumulated.get(idB);
      if (accA == null || accB == null) continue;

      const distanceM = horizontalDistance(pointA, pointB);
      if (distanceM === null) continue;

      const differentialMm = round(Math.abs(accA - accB), 1);
      const distortionInverse =
        differentialMm === 0
          ? Number.POSITIVE_INFINITY
          : (distanceM * 1000) / differentialMm;

      pairs.push({
        pointIdA: idA,
        pointIdB: idB,
        differentialMm,
        distanceM,
        distortionInverse,
        exceedsLimit: distortionInverse < angularDistortionLimit,
      });
    }
  }

  return pairs;
}
