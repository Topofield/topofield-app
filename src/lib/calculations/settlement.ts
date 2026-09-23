// Cálculos del control de asentamientos (PRD § 6.10 y § 6.11).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// Las fórmulas de asentamiento parcial, acumulado y distorsión angular se
// verificaron correctas contra los tres casos de estudio del marco teórico
// (35 valores, todos exactos). La VELOCIDAD no: el documento la calcula mal
// por no definir el mes. Ver docs/prds/04-asentamientos.md, hallazgo 2.

import {
  DAYS_PER_MONTH,
  TREND_DEVIATION_RATE_FACTOR,
  trendDeviationMargin,
} from "./tolerances";
import type { PrecisionOrder } from "@/types/project";
import type {
  AlertLevel,
  ComputedReading,
  DifferentialPair,
  PointInput,
  SettlementHistory,
  SettlementPoint,
  Thresholds,
  Trend,
  TrendDeviation,
  VisitInput,
  VisitResult,
} from "@/types/settlement";
import { ALERT_LEVELS } from "@/types/settlement";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Un punto del catálogo, tal como llega de la base, listo para el motor.
 *
 * Es el ÚNICO sitio donde una fila de `settlement_points` se convierte en
 * `PointInput`. Antes había seis copias, cada una con su `Number()` y su
 * `null`; la Fase 11 añadió dos campos, y añadirlos en seis sitios es la
 * receta de un campo olvidado en uno que ningún test ve.
 *
 * El `Number()` no es decorativo: PostgREST entrega las columnas `DECIMAL`
 * como cadena (ver `thresholdsOf`).
 */
export function pointInputOf(
  row: Pick<
    SettlementPoint,
    | "id"
    | "code"
    | "northing"
    | "easting"
    | "initial_elevation"
    | "active_from"
    | "retired_on"
  >,
): PointInput {
  return {
    id: row.id,
    code: row.code,
    northing: row.northing === null ? null : Number(row.northing),
    easting: row.easting === null ? null : Number(row.easting),
    initialElevation:
      row.initial_elevation === null ? null : Number(row.initial_elevation),
    activeFrom: row.active_from,
    retiredOn: row.retired_on,
  };
}

/**
 * ¿Se mide el punto en una visita de esta fecha (ISO `YYYY-MM-DD`)?
 *
 * La fecha de alta SÍ es vigente; la de baja NO (es la primera en que ya no
 * se mide). Es la gemela de `public.point_active_on` en la base, que la usan
 * los triggers: las dos se prueban en esos mismos bordes.
 *
 * Las fechas ISO se comparan como cadenas: el formato fijo `YYYY-MM-DD` ordena
 * igual lexicográfica que cronológicamente.
 */
export function isPointActiveOn(
  point: Pick<PointInput, "activeFrom" | "retiredOn">,
  date: string,
): boolean {
  return (
    (point.activeFrom === null || date >= point.activeFrom) &&
    (point.retiredOn === null || date < point.retiredOn)
  );
}

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
 * El acumulado se mide contra la **línea base** del punto (Fase 11):
 * - con C0 tecleada, la C0, fechada en la primera visita del lugar (la C0 es
 *   la cota de la visita 0, decisión #14 de la Fase 5);
 * - sin C0, su **primera lectura**, que queda con acumulado 0. Es la «visita
 *   0» de un BM dado de alta a mitad del monitoreo.
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
  const siteBaselineDate = ordered[0]?.date ?? "";

  /** Última lectura conocida de cada punto: su cota y la fecha en que se midió. */
  const previous = new Map<string, { elevation: number; date: string }>();
  /** Línea base de cada punto, fijada al encontrar su primera lectura. */
  const baselines = new Map<string, { elevation: number; date: string }>();

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

      let baseline = baselines.get(reading.pointId);
      if (!baseline) {
        baseline =
          point.initialElevation === null
            ? { elevation: reading.elevation, date: visit.date }
            : { elevation: point.initialElevation, date: siteBaselineDate };
        baselines.set(reading.pointId, baseline);
      }

      const accumulatedSettlement = round(
        (reading.elevation - baseline.elevation) * 1000,
        1,
      );

      readings.push({
        pointId: reading.pointId,
        elevation: reading.elevation,
        partialSettlement,
        accumulatedSettlement,
        velocity,
        alertStatus: "normal" as AlertLevel,
        baselineDate: baseline.date,
        baselineElevation: baseline.elevation,
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
 * **Periodo común (Fase 11).** Si los dos puntos tienen la misma fecha de
 * línea base —todos los puntos originales—, el diferencial es la diferencia
 * de acumulados, como siempre. Si no —un BM dado de alta a mitad del
 * monitoreo—, restar acumulados compararía asentamientos de periodos
 * distintos. Entonces se mide desde `t0`, la más tardía de las dos líneas
 * base, con una sola fórmula para los dos puntos:
 *
 *   asentamiento desde t0 = cota − cota_en_t0
 *   cota_en_t0 = la línea base del punto si es de fecha t0,
 *                o su lectura en la visita de fecha t0 si no.
 *
 * `elevationAt(pointId, date)` da esa lectura. Si el punto no se midió en
 * `t0`, el par queda fuera, como un par sin coordenadas.
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
  elevationAt: (pointId: string, date: string) => number | undefined,
): DifferentialPair[] {
  const byId = new Map(points.map((p) => [p.id, p]));

  /** Asentamiento en mm desde `t0`, o null si no se midió en `t0`. */
  const settlementSince = (r: ComputedReading, t0: string): number | null => {
    const at =
      r.baselineDate === t0 ? r.baselineElevation : elevationAt(r.pointId, t0);
    return at === undefined ? null : (r.elevation - at) * 1000;
  };

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

      const accA = readingA.accumulatedSettlement;
      const accB = readingB.accumulatedSettlement;
      if (accA == null || accB == null) continue;

      const distanceM = horizontalDistance(pointA, pointB);
      if (distanceM === null) continue;

      let settlementA: number;
      let settlementB: number;
      let sinceDate: string;
      if (readingA.baselineDate === readingB.baselineDate) {
        settlementA = accA;
        settlementB = accB;
        sinceDate = readingA.baselineDate;
      } else {
        const t0 =
          readingA.baselineDate > readingB.baselineDate
            ? readingA.baselineDate
            : readingB.baselineDate;
        const sinceA = settlementSince(readingA, t0);
        const sinceB = settlementSince(readingB, t0);
        if (sinceA === null || sinceB === null) continue;
        settlementA = round(sinceA, 1);
        settlementB = round(sinceB, 1);
        sinceDate = t0;
      }

      const differentialMm = round(Math.abs(settlementA - settlementB), 1);
      const distortionInverse =
        differentialMm === 0
          ? Number.POSITIVE_INFINITY
          : (distanceM * 1000) / differentialMm;

      pairs.push({
        pointIdA: idA,
        pointIdB: idB,
        differentialMm,
        settlementAMm: settlementA,
        settlementBMm: settlementB,
        sinceDate,
        distanceM,
        distortionInverse,
        exceedsLimit: distortionInverse < angularDistortionLimit,
      });
    }
  }

  return pairs;
}

/**
 * Clasifica una lectura en el semáforo de 4 niveles (§ 6.11): gana la peor
 * clasificación entre velocidad y acumulado, ambas en valor absoluto.
 *
 * Un valor `null` no clasifica por ese criterio —no lo fuerza a `normal`—: la
 * línea base no tiene velocidad y debe poder clasificarse solo por acumulado.
 *
 * ATENCIÓN: los estados de alerta de los casos de estudio del marco teórico NO
 * se derivan de sus propios umbrales (verificado; ver hallazgo 3 del PRD de
 * fase). No sirven para comprobar esta función.
 */
export function classifyAlert(
  velocity: number | null,
  accumulated: number | null,
  thresholds: Thresholds,
): AlertLevel {
  const byVelocity: AlertLevel =
    velocity === null
      ? "normal"
      : level(Math.abs(velocity), [
          thresholds.velocityCaution,
          thresholds.velocityAlert,
          thresholds.velocityAlarm,
        ]);

  const byAccumulated: AlertLevel =
    accumulated === null
      ? "normal"
      : level(Math.abs(accumulated), [
          thresholds.accumulatedCaution,
          thresholds.accumulatedAlert,
          thresholds.accumulatedAlarm,
        ]);

  return worst(byVelocity, byAccumulated);
}

/** Nivel de un valor absoluto contra [precaución, alerta, alarma]. */
function level(
  absolute: number,
  [caution, alert, alarm]: [number, number, number],
): AlertLevel {
  if (absolute >= alarm) return "alarm";
  if (absolute >= alert) return "alert";
  if (absolute >= caution) return "caution";
  return "normal";
}

/** El peor de dos niveles, según el orden de ALERT_LEVELS. */
export function worst(a: AlertLevel, b: AlertLevel): AlertLevel {
  return ALERT_LEVELS.indexOf(a) >= ALERT_LEVELS.indexOf(b) ? a : b;
}

/**
 * Asigna el nivel de alerta a cada lectura y el peor de ellos a cada visita.
 * Se aplica sobre el resultado de `computeSettlements`.
 */
export function classifyReadings(
  visits: VisitResult[],
  thresholds: Thresholds,
): VisitResult[] {
  return visits.map((visit) => {
    const readings = visit.readings.map((reading) => ({
      ...reading,
      alertStatus: classifyAlert(
        reading.velocity,
        reading.accumulatedSettlement,
        thresholds,
      ),
    }));

    return {
      ...visit,
      readings,
      worstAlert: readings.reduce<AlertLevel>(
        (acc, r) => worst(acc, r.alertStatus),
        "normal",
      ),
    };
  });
}

/**
 * Tendencia de cada punto comparando sus dos últimas velocidades (§ 5.3).
 *
 * Un punto solo aparece en el resultado si tiene **al menos dos velocidades**,
 * lo que exige tres visitas. Con menos no se incluye: devolver `"converging"`
 * afirmaría una convergencia que nadie ha comprobado.
 */
export function computeTrends(visits: VisitResult[]): Record<string, Trend> {
  const velocities = new Map<string, number[]>();

  for (const visit of visits) {
    for (const reading of visit.readings) {
      if (reading.velocity === null) continue;
      const list = velocities.get(reading.pointId) ?? [];
      list.push(reading.velocity);
      velocities.set(reading.pointId, list);
    }
  }

  const trends: Record<string, Trend> = {};
  for (const [pointId, list] of velocities) {
    if (list.length < 2) continue;
    const last = Math.abs(list[list.length - 1]!);
    const previous = Math.abs(list[list.length - 2]!);
    trends[pointId] = last > previous ? "accelerating" : "converging";
  }
  return trends;
}

/**
 * Lecturas fuera de la tendencia de su punto (Fase 12), por visita y por punto.
 *
 * Para cada lectura, con la lectura anterior de ESE punto (la última visita en
 * que se midió, como el motor) y la velocidad de esa lectura anterior:
 *
 *   d = signo de V_prev (−1 si es 0: bajando)
 *   contraria  si  d · parcial < −m
 *   excesiva   si  d · parcial >  2 · |V_prev| · Δt + m
 *
 * con `m` el margen del orden de la visita (`trendDeviationMargin`). La banda
 * admite que la consolidación frene hasta cero —moverse menos de lo previsto
 * nunca avisa—: extrapolar la velocidad anterior, el criterio obvio, marcaba
 * lecturas correctas en el caso típico del módulo (PRD de la fase, hallazgo 1).
 *
 * Solo evalúa desde la tercera lectura del punto (hace falta una velocidad
 * previa) y nunca con un intervalo de 0 días. Una visita sin orden en
 * `orderByVisit` no se evalúa: sin margen no hay regla.
 *
 * Es una función aparte, y no un campo de `computeSettlements`, porque
 * necesita el orden de cada visita, que `VisitInput` no lleva.
 */
export function detectTrendDeviations(
  visits: VisitResult[],
  orderByVisit: ReadonlyMap<string, PrecisionOrder>,
): Map<string, Map<string, TrendDeviation>> {
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
  const previous = new Map<
    string,
    { elevation: number; date: string; velocity: number | null }
  >();
  const out = new Map<string, Map<string, TrendDeviation>>();

  for (const visit of ordered) {
    const order = orderByVisit.get(visit.visitId);
    for (const reading of visit.readings) {
      const prev = previous.get(reading.pointId);
      previous.set(reading.pointId, {
        elevation: reading.elevation,
        date: visit.date,
        velocity: reading.velocity,
      });

      if (!order || !prev || prev.velocity === null) continue;
      const months = monthsBetween(prev.date, visit.date);
      if (months <= 0) continue;

      const partialMm = (reading.elevation - prev.elevation) * 1000;
      const direction = prev.velocity > 0 ? 1 : -1;
      const marginMm = trendDeviationMargin(order);
      const expectedMm = Math.abs(prev.velocity) * months;
      const along = direction * partialMm;

      const kind =
        along < -marginMm
          ? "contrary"
          : along > TREND_DEVIATION_RATE_FACTOR * expectedMm + marginMm
            ? "excessive"
            : null;
      if (!kind) continue;

      const byPoint = out.get(visit.visitId) ?? new Map();
      byPoint.set(reading.pointId, {
        pointId: reading.pointId,
        kind,
        partialMm: round(partialMm, 1),
        previousVelocity: prev.velocity,
        expectedMm: round(expectedMm, 1),
        marginMm,
      });
      out.set(visit.visitId, byPoint);
    }
  }

  return out;
}

/**
 * Histórico completo de un lugar: visitas calculadas y clasificadas,
 * diferenciales de la **última** visita y tendencia por punto.
 */
export function computeHistory(
  points: PointInput[],
  visits: VisitInput[],
  thresholds: Thresholds,
): SettlementHistory {
  const computed = classifyReadings(
    computeSettlements(points, visits),
    thresholds,
  );

  // Cota de cada punto en cada fecha de visita, para los diferenciales sobre
  // el periodo común. Las fechas de visita son únicas por lugar (la captura
  // exige que cada una sea posterior a la anterior).
  const elevations = new Map<string, number>();
  for (const visit of computed) {
    for (const r of visit.readings) {
      elevations.set(`${r.pointId}|${visit.date}`, r.elevation);
    }
  }

  const last = computed[computed.length - 1];
  const differentials = last
    ? computeDifferentials(
        points,
        last.readings,
        thresholds.angularDistortionLimit,
        (pointId, date) => elevations.get(`${pointId}|${date}`),
      )
    : [];

  return {
    visits: computed,
    differentials,
    trends: computeTrends(computed),
  };
}
