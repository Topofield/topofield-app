// Libreta de nivelación de una visita de asentamientos (Fase 18).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase.
//
// La visita NO trae motor de nivelación propio: su libreta es un circuito
// cerrado sobre el BM de amarre y la calcula `computeLeveling` tal cual. Lo que
// añade este módulo es el paso de la libreta a las cotas de los puntos de
// control —que dejan de teclearse— y la plantilla para capturar en campo. Ver
// docs/prds/17-libreta-panel-asentamientos.md.

import {
  computeLeveling,
  detectLevelingOrder,
  samePointCode,
  totalDistanceFromReadings,
  withinTolerance,
} from "./leveling";
import { isPointActiveOn } from "./settlement";
import { levelingTolerance } from "./tolerances";
import type {
  ComputedReading,
  LevelingResult,
  ReadingInput,
} from "@/types/leveling";
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
 * Calcula la libreta de una visita: circuito cerrado que arranca y termina en
 * el BM de amarre, sin vuelta (decisiones 7 y 9 del PRD de la Fase 18).
 *
 * Una libreta A MEDIAS —capturando en vivo, sin la V− de cierre todavía— se
 * calcula como recorrido abierto: sin cierre ni compensación. Como cerrada,
 * el motor compararía la cota del último punto de la cadena con la del amarre
 * y daría un «error de cierre» de metros, que se guardaría y se pintaría como
 * fuera de tolerancia.
 */
export function computeVisitBook(
  rows: BookRowInput[],
  referenceElevation: number,
  order: PrecisionOrder,
): LevelingResult {
  const closes = rows.length >= 2 && rows.at(-1)!.foresight != null;
  return computeLeveling({
    type: closes ? "closed" : "open",
    startElevation: referenceElevation,
    endElevation: null,
    order,
    forward: rows,
    return: null,
  });
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

/**
 * Deriva la cota de cada punto de control de la libreta ya calculada.
 *
 * - Una fila con V− cuyo código es el de un punto de control da su cota. Vale
 *   para cualquier tipo de fila: un punto de control puede ser punto de cambio.
 * - La cota es la COMPENSADA (`elevationCorrected`). Si la libreta no se
 *   compensó —fuera de tolerancia o sin distancias—, el motor la deja igual a
 *   la calculada, así que no hay caso aparte (decisión 4).
 * - El mismo punto con V− en dos filas es un error y no da cota: no hay
 *   criterio obvio para elegir una.
 * - Un punto no vigente en la fecha de la visita avisa y no da cota: el trigger
 *   de vigencia la rechazaría de todas formas (Fase 11).
 * - Un punto vigente que no aparece avisa. Se puede guardar así; cerrar la
 *   visita sigue exigiendo todas las lecturas.
 * - Un código que no es punto de control (el amarre, un punto de cambio, un
 *   auxiliar) es una radiación normal y no dice nada.
 */
export function deriveControlElevations(
  result: LevelingResult,
  points: PointInput[],
  visitDate: string,
): { readings: DerivedElevation[]; issues: BookIssue[] } {
  const rowsByPoint = new Map<string, number[]>();
  result.forward.readings.forEach((r, index) => {
    if (r.foresight == null) return;
    const match = points.find((p) => samePointCode(p.code, r.pointCode));
    if (!match) return;
    rowsByPoint.set(match.id, [...(rowsByPoint.get(match.id) ?? []), index]);
  });

  const readings: DerivedElevation[] = [];
  const issues: BookIssue[] = [];

  for (const p of [...points].sort(byCode)) {
    const rows = rowsByPoint.get(p.id);
    const active = isPointActiveOn(p, visitDate);
    if (!rows) {
      if (active) {
        issues.push({ kind: "missing", level: "warning", pointId: p.id, code: p.code });
      }
      continue;
    }
    if (rows.length > 1) {
      issues.push({ kind: "duplicate", level: "error", pointId: p.id, code: p.code, rows });
      continue;
    }
    const rowIndex = rows[0]!;
    if (!active) {
      issues.push({ kind: "inactive", level: "warning", pointId: p.id, code: p.code, row: rowIndex });
      continue;
    }
    readings.push({
      pointId: p.id,
      elevation: round4(result.forward.readings[rowIndex]!.elevationCorrected),
      rowIndex,
    });
  }

  // Avisos en el orden en que aparecen en la libreta; los ausentes al final.
  const position = (i: BookIssue) =>
    i.kind === "missing" ? Infinity : i.kind === "duplicate" ? i.rows[0]! : i.row;
  issues.sort((a, b) => position(a) - position(b));
  readings.sort((a, b) => a.rowIndex - b.rowIndex);
  return { readings, issues };
}

/**
 * La cota de catálogo de cada fila de la libreta que es **otro BM** (Fase 30):
 * un punto de referencia de tipo BM, con cota, distinto del amarre y que no es
 * un punto de control del lugar —si un código es las dos cosas, gana el punto
 * de control, como en `deriveControlElevations`—. Solo las filas con vista
 * menos, que son las que dan cota. Las demás, null.
 *
 * Es lo que el guardado copia en `settlement_book_readings.catalog_elevation`,
 * como la visita copia la cota del amarre: corregir después el catálogo no
 * cambia la comprobación de una visita cerrada.
 */
export function catalogElevationsOf(
  rows: { pointCode: string; foresight: number | null }[],
  catalog: { code: string; type: string; elevation: number | null }[],
  amarreCode: string,
  points: Pick<PointInput, "code">[],
): (number | null)[] {
  return rows.map((r) => {
    if (r.foresight == null) return null;
    if (samePointCode(r.pointCode, amarreCode)) return null;
    if (points.some((p) => samePointCode(p.code, r.pointCode))) return null;
    const bm = catalog.find(
      (c) => c.type === "bm" && c.elevation != null && samePointCode(c.code, r.pointCode),
    );
    return bm ? Number(bm.elevation) : null;
  });
}

/**
 * Comprueba los BM de control de la libreta (Fase 30, CR2): cada fila con cota
 * de catálogo y vista menos se compara con esa cota.
 *
 * - Se compara la cota CALCULADA, no la compensada: es el desnivel medido
 *   desde el amarre; la compensada ya repartió el error del circuito.
 * - La tolerancia es la de una línea entre dos puntos conocidos, K·√L del orden
 *   de la visita, con L la distancia acumulada hasta la fila. La frontera es la
 *   del cierre (`withinTolerance`, C-13). Sin distancias no hay veredicto.
 * - La diferencia va a 0.1 mm desde la cota a 4 decimales, que es como se
 *   guarda: el editor, que calcula en vivo, y la vista, que lee la libreta
 *   guardada, dan el mismo número.
 *
 * Con dos BM no se sabe cuál se movió; eso lo dice el mensaje, no el cálculo.
 */
export function checkBenchmarks(
  readings: Pick<ComputedReading, "pointCode" | "foresight" | "elevationCalculated" | "distanceAccumulatedKm">[],
  catalogElevations: (number | null)[],
  order: PrecisionOrder,
): BenchmarkCheck[] {
  const checks: BenchmarkCheck[] = [];
  readings.forEach((r, rowIndex) => {
    const catalogElevation = catalogElevations[rowIndex];
    if (catalogElevation == null || r.foresight == null) return;
    if (!Number.isFinite(r.elevationCalculated)) return;
    const measuredElevation = round4(r.elevationCalculated);
    const difference = Math.round((measuredElevation - catalogElevation) * 1e4) / 10;
    const differenceMm = Object.is(difference, -0) ? 0 : difference;
    // Como el cierre: sin una distancia válida no hay tolerancia. El motor deja
    // el acumulado en 0 cuando la libreta no trae distancias.
    const distanceKm = r.distanceAccumulatedKm;
    const toleranceMm =
      distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0
        ? levelingTolerance(order, distanceKm)
        : null;
    checks.push({
      rowIndex,
      code: r.pointCode.trim(),
      catalogElevation,
      measuredElevation,
      differenceMm,
      toleranceMm,
      meetsTolerance: toleranceMm != null ? withinTolerance(differenceMm, toleranceMm) : null,
    });
  });
  return checks;
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
 * La libreta de una visita, tramo a tramo y sin compensar (Fase 37, decisión
 * 14). Un tramo arranca en un BM del lugar; termina en otro BM del lugar (de
 * enlace), en el mismo (cerrado) o en sus puntos (abierto). Su cierre solo
 * verifica: la cota de cada punto es la de su lectura.
 */
export function computeBook(rows: readonly BookRowInput[], benchmarks: readonly BenchmarkInput[]): VisitBook {
  const starts = tramoStarts(rows);
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
        ? benchmarkOf(last.pointCode, benchmarks)
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
 * de cambio que no es el último, también su V+.
 */
export function bookPending(rows: readonly BookRowPayload[]): number[] {
  const last = rows.length - 1;
  return rows.flatMap((row, i) => {
    if (i === 0 || row.startsSection) return row.backsight == null ? [i] : [];
    if (row.pointType === "intermediate") return row.foresight == null ? [i] : [];
    const missingFore = row.foresight == null;
    const missingBack = row.pointType === "pc" && i !== last && row.backsight == null;
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
): BenchmarkCheck[] {
  const checks: BenchmarkCheck[] = [];
  for (const tramo of book.tramos) {
    for (let i = tramo.start + 1; i <= tramo.end; i++) {
      if (i === tramo.end && tramo.kind !== "open") continue;
      const row = rows[i]!;
      const computed = book.readings[i]!;
      if (row.foresight == null || !Number.isFinite(computed.elevationCalculated)) continue;
      if (points.some((p) => samePointCode(p.code, row.pointCode))) continue;
      const bm = benchmarks.find((b) => samePointCode(b.code, row.pointCode));
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
