// Libreta de nivelación de una visita de asentamientos (Fases 18 y 37).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// La visita NO trae motor de nivelación propio: cada tramo de su libreta —una
// lista de armadas desde un BM del lugar— lo calcula `computeLeveling` sin
// compensar. Lo que añade este módulo es el paso de la libreta a las cotas de
// los puntos de control, la plantilla de la visita nueva y lo que queda por
// leer. Ver docs/prds/36-ux-asentamientos.md.

import {
  computeLeveling,
  detectLevelingOrder,
  samePointCode,
  totalDistanceFromReadings,
  withinTolerance,
} from "./leveling";
import { isPointActiveOn } from "./settlement";
import { levelingTolerance } from "./tolerances";
import type { ComputedReading, ReadingInput } from "@/types/leveling";
import { PRECISION_ORDERS, type PrecisionOrder } from "@/types/project";
import type {
  BenchmarkCheck,
  BenchmarkInput,
  BookIssue,
  BookRowPayload,
  DerivedElevation,
  PointInput,
  SettlementBookReading,
  TramoResult,
  VisitBook,
  VisitVerification,
} from "@/types/settlement";

/** La fila de la libreta como entra al motor: la de la nivelación, más el inicio de tramo. */
export type BookRowInput = ReadingInput & { startsSection?: boolean };

/**
 * Una fila de libreta, tal como llega de la base, lista para el editor y el
 * motor. El `Number()` no es decorativo: PostgREST entrega las columnas
 * `DECIMAL` como cadena (ver `pointInputOf`).
 */
export function bookRowOf(
  row: Pick<
    SettlementBookReading,
    | "point_code"
    | "point_type"
    | "backsight"
    | "foresight"
    | "back_upper_m"
    | "back_lower_m"
    | "fore_upper_m"
    | "fore_lower_m"
    | "back_distance_m"
    | "fore_distance_m"
  > & { starts_section?: boolean | null },
): BookRowPayload {
  const n = (v: number | string | null) => (v === null ? null : Number(v));
  return {
    pointCode: row.point_code,
    pointType: row.point_type,
    backsight: n(row.backsight),
    foresight: n(row.foresight),
    backUpperM: n(row.back_upper_m),
    backLowerM: n(row.back_lower_m),
    foreUpperM: n(row.fore_upper_m),
    foreLowerM: n(row.fore_lower_m),
    backDistanceM: n(row.back_distance_m),
    foreDistanceM: n(row.fore_distance_m),
    startsSection: Boolean(row.starts_section),
  };
}

/** La fila como entra al motor: el acumulado lo deriva él, no el cliente. */
export function bookRowInputOf(row: BookRowPayload): BookRowInput {
  return { ...row, distanceAccumulatedKm: null };
}

/**
 * Redondeo a la resolución de `settlement_readings.elevation` (4 decimales).
 * Las cotas derivadas se comparan con las persistidas para decidir qué
 * reescribir: sin redondear aquí, cada guardado vería una diferencia de coma
 * flotante y reescribiría lecturas que no cambiaron.
 */
function round4(value: number): number {
  const r = Math.round(value * 1e4) / 1e4;
  return Object.is(r, -0) ? 0 : r;
}

/** Orden natural de códigos: PC-2 antes que PC-10. */
function byCode(a: PointInput, b: PointInput): number {
  return a.code.localeCompare(b.code, "es", { numeric: true });
}

// ---------------------------------------------------------------------------
// Fase 37: la libreta por tramos, sin compensar.
// ---------------------------------------------------------------------------

/** Dónde arranca cada tramo: la primera fila y las marcadas (Fase 37, decisión 8). */
export function tramoStarts(rows: readonly { startsSection?: boolean }[]): number[] {
  return rows.flatMap((row, i) => (i === 0 || row.startsSection ? [i] : []));
}

const round1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
};

function benchmarkOf(code: string, benchmarks: readonly BenchmarkInput[]): BenchmarkInput | undefined {
  return benchmarks.find((b) => samePointCode(b.code, code));
}

/**
 * Los BM que pueden verificar una visita: todos menos los que ella misma
 * midió —un punto auxiliar que se guardó en los BM del lugar—, que darían un
 * cierre de cero contra su propia medida (revisión final de la Fase 37).
 */
export function verifyingBenchmarks(benchmarks: readonly BenchmarkInput[], visitId?: string): BenchmarkInput[] {
  return visitId ? benchmarks.filter((b) => b.originVisitId == null || b.originVisitId !== visitId) : [...benchmarks];
}

/**
 * La libreta de una visita, tramo a tramo y sin compensar (Fase 37, decisión
 * 14). Un tramo arranca en un BM del lugar; termina en otro BM del lugar (de
 * enlace), en el mismo (cerrado) o en sus puntos (abierto). Su cierre solo
 * verifica: la cota de cada punto es la de su lectura.
 */
export function computeBook(
  rows: readonly BookRowInput[],
  benchmarks: readonly BenchmarkInput[],
  visitId?: string,
): VisitBook {
  const starts = tramoStarts(rows);
  const verifying = verifyingBenchmarks(benchmarks, visitId);
  const tramos: TramoResult[] = [];
  const readings: ComputedReading[] = [];
  starts.forEach((start, k) => {
    const end = (starts[k + 1] ?? rows.length) - 1;
    const slice = rows.slice(start, end + 1);
    const first = slice[0]!;
    const last = slice.at(-1)!;
    const startBm = benchmarkOf(first.pointCode, benchmarks);
    // Qué filas tienen cota: la cadena sigue mientras cada V+ y cada V− estén
    // leídas; una intermedia sin lectura solo se pierde a sí misma.
    const valid: boolean[] = [];
    let chain = startBm != null;
    slice.forEach((row, j) => {
      if (j === 0) {
        valid.push(chain);
        chain = chain && row.backsight != null;
      } else if (row.pointType === "intermediate") {
        valid.push(chain && row.foresight != null);
      } else {
        chain = chain && row.foresight != null;
        valid.push(chain);
        chain = chain && row.backsight != null;
      }
    });
    // La cadena está entera si la V+ del arranque y cada V− y V+ que siguen
    // están leídas; las intermedias no cuentan.
    const complete =
      valid[0]! &&
      (slice.length === 1 || first.backsight != null) &&
      slice.every((row, j) => j === 0 || row.pointType === "intermediate" || valid[j]);
    const endBm =
      slice.length > 1 && last.pointType !== "intermediate" && valid.at(-1)
        ? benchmarkOf(last.pointCode, verifying)
        : undefined;
    const kind = !endBm ? "open" : samePointCode(endBm.code, first.pointCode) ? "closed" : "link";
    const result = computeLeveling({
      type: kind,
      startElevation: startBm?.elevation ?? Number.NaN,
      endElevation: kind === "link" ? endBm!.elevation : null,
      order: "tercer_orden",
      compensation: "never",
      // `startsSection` viaja en la fila y el motor de nivelación lo ignora.
      forward: [...slice],
      return: null,
    });
    const km = totalDistanceFromReadings(slice);
    const distanceKm = km > 0 ? km : null;
    const order = kind === "open" || !startBm ? null : detectLevelingOrder(result, kind).order;
    tramos.push({
      start,
      end,
      startCode: first.pointCode.trim(),
      endCode: endBm ? last.pointCode.trim() : null,
      kind,
      startElevation: startBm?.elevation ?? null,
      closureMm: kind === "open" || result.closureErrorMm == null ? null : round1(result.closureErrorMm),
      order,
      toleranceMm: order && distanceKm != null ? round1(levelingTolerance(order, distanceKm)) : null,
      distanceKm,
      complete,
    });
    readings.push(
      ...result.forward.readings.map((x, j) =>
        valid[j] ? x : { ...x, elevationCalculated: Number.NaN, elevationCorrected: Number.NaN },
      ),
    );
  });
  return { tramos, readings };
}

/** El tramo peor resume la visita (Fase 37, decisión 15). */
export function bookVerification(book: VisitBook): VisitVerification {
  const rank = (o: PrecisionOrder) => PRECISION_ORDERS.indexOf(o);
  const unverified = book.tramos.find((t) => t.order == null);
  const worst =
    unverified ?? [...book.tramos].sort((a, b) => rank(b.order!) - rank(a.order!))[0] ?? null;
  const lengths = book.tramos.flatMap((t) => (t.distanceKm != null ? [t.distanceKm] : []));
  return {
    verified: book.tramos.length > 0 && !unverified,
    order: unverified || !worst ? null : worst.order,
    worst,
    distanceKm: lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) : null,
  };
}

/**
 * Las cotas de los puntos de control de una visita (Fase 37): la de la fila
 * con su lectura —VI o V−—, sin corregir. Las filas sin cota (por leer, o
 * tras una cadena incompleta) no cuentan, ni como lectura ni como ausencia.
 */
export function bookElevations(
  book: VisitBook,
  rows: readonly BookRowInput[],
  points: PointInput[],
  visitDate: string,
): { readings: DerivedElevation[]; issues: BookIssue[] } {
  const measured = new Map<string, number[]>();
  const pending = new Set<string>();
  rows.forEach((row, index) => {
    const match = points.find((p) => samePointCode(p.code, row.pointCode));
    if (!match) return;
    if (row.foresight != null && Number.isFinite(book.readings[index]?.elevationCalculated)) {
      measured.set(match.id, [...(measured.get(match.id) ?? []), index]);
    } else if (row.foresight == null) {
      pending.add(match.id);
    }
  });

  const readings: DerivedElevation[] = [];
  const issues: BookIssue[] = [];
  for (const p of [...points].sort(byCode)) {
    const found = measured.get(p.id);
    const active = isPointActiveOn(p, visitDate);
    if (!found) {
      if (active && !pending.has(p.id)) issues.push({ kind: "missing", level: "warning", pointId: p.id, code: p.code });
      continue;
    }
    if (found.length > 1) {
      issues.push({ kind: "duplicate", level: "error", pointId: p.id, code: p.code, rows: found });
      continue;
    }
    const rowIndex = found[0]!;
    if (!active) {
      issues.push({ kind: "inactive", level: "warning", pointId: p.id, code: p.code, row: rowIndex });
      continue;
    }
    readings.push({ pointId: p.id, elevation: round4(book.readings[rowIndex]!.elevationCalculated), rowIndex });
  }
  const position = (i: BookIssue) => (i.kind === "missing" ? Infinity : i.kind === "duplicate" ? i.rows[0]! : i.row);
  issues.sort((a, b) => position(a) - position(b));
  readings.sort((a, b) => a.rowIndex - b.rowIndex);
  return { readings, issues };
}

const blankReadings = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;

/**
 * La libreta de una visita nueva (Fase 37, decisión 4): las armadas de la
 * anterior —sus BM, sus puntos de cambio y sus puntos de control—, sin
 * lecturas, sin los puntos dados de baja y con los dados de alta antes del BM
 * de cierre. Sin anterior, una armada desde el primer BM del lugar.
 */
export function bookTemplate(
  previous: readonly BookRowPayload[] | null,
  points: PointInput[],
  visitDate: string,
  benchmarks: readonly BenchmarkInput[],
): BookRowPayload[] {
  const active = points.filter((p) => isPointActiveOn(p, visitDate)).sort(byCode);
  const asIntermediate = (code: string): BookRowPayload => ({ pointCode: code, pointType: "intermediate", ...blankReadings });

  if (!previous || previous.length === 0) {
    const first = benchmarks[0];
    if (!first) return [];
    return [
      { pointCode: first.code, pointType: "bm", startsSection: true, ...blankReadings },
      ...active.map((p) => asIntermediate(p.code)),
    ];
  }

  const controlOf = (code: string) => points.find((p) => samePointCode(p.code, code));
  const kept: BookRowPayload[] = previous
    .filter((row) => {
      const p = row.pointType === "intermediate" ? controlOf(row.pointCode) : undefined;
      return !p || isPointActiveOn(p, visitDate);
    })
    .map((row, i) => ({
      pointCode: row.pointCode,
      pointType: row.pointType,
      startsSection: i === 0 || Boolean(row.startsSection),
      ...blankReadings,
    }));
  const added = active
    .filter((p) => !kept.some((row) => samePointCode(row.pointCode, p.code)))
    .map((p) => asIntermediate(p.code));
  const last = kept.at(-1)!;
  return last.pointType !== "intermediate" && kept.length > 1
    ? [...kept.slice(0, -1), ...added, last]
    : [...kept, ...added];
}

/**
 * Las filas que esperan una lectura (Fase 37, decisión 9): la V+ de un
 * arranque, la VI de una intermedia y la V− de cualquier otra fila; un punto
 * de cambio del que sale la armada siguiente, también su V+.
 */
export function bookPending(rows: readonly BookRowPayload[]): number[] {
  const last = rows.length - 1;
  return rows.flatMap((row, i) => {
    if (i === 0 || row.startsSection) return row.backsight == null ? [i] : [];
    if (row.pointType === "intermediate") return row.foresight == null ? [i] : [];
    const missingFore = row.foresight == null;
    // Un punto de cambio abre la armada siguiente salvo que esta salga de un
    // BM del lugar (revisión final de la Fase 37).
    const opensNext = i !== last && !rows[i + 1]!.startsSection;
    const missingBack = row.pointType === "pc" && opensNext && row.backsight == null;
    return missingFore || missingBack ? [i] : [];
  });
}

export function visitStatusOf(rows: readonly BookRowPayload[]): "draft" | "in_progress" | "calculated" {
  if (rows.length === 0) return "draft";
  return bookPending(rows).length > 0 ? "in_progress" : "calculated";
}

/** Los puntos auxiliares de la libreta (Fase 37, decisión 11). */
export function auxiliaryPoints(
  rows: readonly BookRowPayload[],
  points: Pick<PointInput, "code">[],
  benchmarks: readonly BenchmarkInput[],
): { rowIndex: number; code: string }[] {
  const seen = new Set<string>();
  return rows.flatMap((row, i) => {
    if (i === 0 || row.startsSection || row.pointType === "intermediate" || row.foresight == null) return [];
    if (points.some((p) => samePointCode(p.code, row.pointCode))) return [];
    if (benchmarks.some((b) => samePointCode(b.code, row.pointCode))) return [];
    const key = row.pointCode.trim().toUpperCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ rowIndex: i, code: row.pointCode.trim() }];
  });
}

/**
 * Los BM del lugar leídos de paso (Fase 30, ahora contra `site_benchmarks`):
 * cada fila con cota cuyo código es un BM del lugar, que no es punto de
 * control, ni el arranque de su tramo, ni su BM de cierre —ese es el cierre—.
 * Tolerancia de tercer orden sobre la distancia hasta la fila (decisión 16).
 */
export function bookBenchmarkChecks(
  book: VisitBook,
  rows: readonly BookRowInput[],
  benchmarks: readonly BenchmarkInput[],
  points: Pick<PointInput, "code">[],
  visitId?: string,
): BenchmarkCheck[] {
  const checks: BenchmarkCheck[] = [];
  const verifying = verifyingBenchmarks(benchmarks, visitId);
  for (const tramo of book.tramos) {
    for (let i = tramo.start + 1; i <= tramo.end; i++) {
      if (i === tramo.end && tramo.kind !== "open") continue;
      const row = rows[i]!;
      const computed = book.readings[i]!;
      if (row.foresight == null || !Number.isFinite(computed.elevationCalculated)) continue;
      if (points.some((p) => samePointCode(p.code, row.pointCode))) continue;
      const bm = verifying.find((b) => samePointCode(b.code, row.pointCode));
      if (!bm) continue;
      const measuredElevation = round4(computed.elevationCalculated);
      const raw = Math.round((measuredElevation - bm.elevation) * 1e4) / 10;
      const differenceMm = Object.is(raw, -0) ? 0 : raw;
      const km = computed.distanceAccumulatedKm;
      const toleranceMm = km != null && Number.isFinite(km) && km > 0 ? levelingTolerance("tercer_orden", km) : null;
      checks.push({
        rowIndex: i, code: row.pointCode.trim(), catalogElevation: bm.elevation, measuredElevation,
        differenceMm, toleranceMm,
        meetsTolerance: toleranceMm != null ? withinTolerance(differenceMm, toleranceMm) : null,
      });
    }
  }
  return checks;
}
