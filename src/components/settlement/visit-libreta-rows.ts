// Las filas del paso 1 · Libreta de la visita (Fase 37, decisiones 7 a 9 y
// 20): la tabla de la nivelación con los rótulos de la visita, la lista de
// armadas, la verificación de cada tramo, qué retomar y el movimiento de cada
// punto desde la visita anterior. Sin «use client»: lo usan la pantalla y las
// pruebas.
import { samePointCode } from "@/lib/calculations/leveling";
import { daysBetween, detectTrendDeviations } from "@/lib/calculations/settlement";
import { bookPending } from "@/lib/calculations/settlement-book";
import { formatSignedMm } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import type { BenchmarkCheck, BookRowPayload, VisitBook, VisitResult } from "@/types/settlement";
import type { SheetRow } from "@/components/leveling/libreta-rows";
import { visitArmadaSpans, type VisitArmadaSpan } from "./visit-armadas";

const finite = (v: number | null | undefined): number | null => (v != null && Number.isFinite(v) ? v : null);
const isStart = (rows: readonly BookRowPayload[], i: number) => i === 0 || Boolean(rows[i]!.startsSection);

/** Una fila de la tabla: la de la nivelación, con los rótulos de la visita. */
export type VisitSheetRow = Omit<SheetRow, "badge"> & {
  /** «BM del lugar», «punto de cambio», «BM · −0.4 mm», «cierra», «llega», «pendiente». */
  badge: string | null;
  /** La fila espera una lectura (`bookPending`). */
  pending: boolean;
};

/** La armada de cada fila: la que cierra, en la que es vista a un punto o la que abre un tramo. */
function armadaOfRows(rows: readonly BookRowPayload[], spans: VisitArmadaSpan[]): (number | null)[] {
  const of: (number | null)[] = rows.map(() => null);
  spans.forEach((s, k) => {
    if (s.closer != null) of[s.closer] = k;
    for (const i of s.intermediates) of[i] = k;
    if (of[s.opener] == null) of[s.opener] = k;
  });
  return of;
}

/** La tabla de la hoja de la visita: Punto, V+ y su distancia, AI, V− y su distancia, VI y la cota. */
export function visitSheetRows(
  rows: readonly BookRowPayload[],
  book: VisitBook,
  checks: readonly BenchmarkCheck[],
): VisitSheetRow[] {
  const armadas = armadaOfRows(rows, visitArmadaSpans(rows));
  const pending = new Set(bookPending(rows));
  const ends = new Map(book.tramos.filter((t) => t.kind !== "open").map((t) => [t.end, t.kind]));
  return rows.map((row, i) => {
    const c = book.readings[i];
    const mid = row.pointType === "intermediate";
    const elevation = finite(c?.elevationCalculated);
    const check = checks.find((x) => x.rowIndex === i);
    const badge = isStart(rows, i)
      ? "BM del lugar"
      : ends.has(i)
        ? ends.get(i) === "closed"
          ? "cierra"
          : "llega"
        : check
          ? `BM · ${formatSignedMm(check.differenceMm)} mm`
          : row.pointType === "pc"
            ? "punto de cambio"
            : mid && pending.has(i)
              ? "pendiente"
              : null;
    return {
      pointCode: row.pointCode,
      badge,
      pending: pending.has(i),
      backsight: mid ? null : row.backsight,
      backDistanceM: mid || row.backsight == null ? null : (c?.backDistanceResolvedM ?? row.backDistanceM),
      instrumentHeight: elevation != null && !mid && row.backsight != null ? finite(c?.instrumentHeight) : null,
      foresight: mid ? null : row.foresight,
      foreDistanceM: mid || row.foresight == null ? null : (c?.foreDistanceResolvedM ?? row.foreDistanceM),
      intermediate: mid ? row.foresight : null,
      elevation,
      armada: armadas[i] ?? null,
    };
  });
}

export interface VisitArmadaItem {
  k: number;
  /** «Armada 1 · desde BM-1». */
  title: string;
  /** «BM del lugar · 5 vistas a puntos · V− a CP-1». */
  detail: string;
  /** Alguna de sus lecturas falta. */
  pending: boolean;
  /** Las vistas a los puntos, con su cota si ya la tienen (para el teléfono). */
  points: { code: string; reading: number | null; elevation: number | null }[];
}

const views = (n: number) => (n === 1 ? "1 vista a un punto" : `${n} vistas a puntos`);

/** La lista de armadas de la visita, al lado de la tabla y en el teléfono. */
export function armadaItems(rows: readonly BookRowPayload[], book?: VisitBook): VisitArmadaItem[] {
  const pending = new Set(bookPending(rows));
  return visitArmadaSpans(rows).map((s, k) => {
    const opener = rows[s.opener]!;
    const closer = s.closer != null ? rows[s.closer]! : null;
    const read = s.intermediates.filter((i) => rows[i]!.foresight != null).length;
    const total = s.intermediates.length;
    // La V+ del punto de cambio es de esta armada; su V− es de la anterior.
    const backMissing = opener.backsight == null && (isStart(rows, s.opener) || pending.has(s.opener));
    const isPending =
      backMissing || read < total || (closer != null && closer.foresight == null);
    const from = isStart(rows, s.opener) ? "BM del lugar" : "punto de cambio";
    const views_ = isPending && read < total ? `${read} de ${total} puntos · a medias` : views(total);
    const fore = closer ? `V− a ${closer.pointCode.trim()}` : "sin vista adelante";
    return {
      k,
      title: `Armada ${k + 1} · desde ${opener.pointCode.trim()}`,
      detail: isPending && read < total ? `${from} · ${views_}` : `${from} · ${views_} · ${fore}`,
      pending: isPending,
      points: s.intermediates.map((i) => ({
        code: rows[i]!.pointCode.trim(),
        reading: rows[i]!.foresight,
        elevation: finite(book?.readings[i]?.elevationCalculated),
      })),
    };
  });
}

export interface TramoItem {
  /** «Tramo desde BM-1». */
  title: string;
  /** «vuelve a BM-1», «llega a BM-2», «termina en sus puntos» o «a medias». */
  route: string;
  /** El cierre o la llegada, en mm; null si no termina en un BM del lugar. */
  closure: string | null;
  /** «Segundo orden (2.0 mm en 0.113 km)» o por qué no se verifica. */
  verdict: string;
  verified: boolean;
}

/** La verificación de cada tramo (decisiones 14 y 15): el cierre comprueba, no se reparte. */
export function tramoItems(book: VisitBook): TramoItem[] {
  return book.tramos.map((t) => {
    const title = `Tramo desde ${t.startCode}`;
    if (!t.complete) {
      return { title, route: "a medias", closure: null, verdict: "Falta leer parte de la cadena.", verified: false };
    }
    if (t.kind === "open") {
      return {
        title,
        route: "termina en sus puntos",
        closure: null,
        verdict: "Sin verificación: no termina en un BM del lugar.",
        verified: false,
      };
    }
    const route = t.kind === "closed" ? `vuelve a ${t.endCode}` : `llega a ${t.endCode}`;
    const closure = t.closureMm == null ? null : `${formatSignedMm(t.closureMm)} mm`;
    if (t.order && t.toleranceMm != null && t.distanceKm != null) {
      return {
        title,
        route,
        closure,
        verdict: `${PRECISION_ORDER_LABELS[t.order]} (${t.toleranceMm.toFixed(1)} mm en ${t.distanceKm.toFixed(3)} km)`,
        verified: true,
      };
    }
    return {
      title,
      route,
      closure,
      verdict:
        t.distanceKm == null
          ? "Sin distancias: el cierre no da orden."
          : "Fuera de los órdenes: el cierre supera la tolerancia de todos.",
      verified: false,
    };
  });
}

/**
 * Qué retomar en una visita a medias (decisión 9): la armada y la fila de la
 * primera lectura que falta, con el texto del aviso. Null si no falta nada.
 */
export function resumeOf(rows: readonly BookRowPayload[]): { k: number; rowIndex: number; text: string } | null {
  const rowIndex = bookPending(rows)[0];
  if (rowIndex == null) return null;
  const spans = visitArmadaSpans(rows);
  const row = rows[rowIndex]!;
  const code = row.pointCode.trim();
  if (row.pointType === "intermediate") {
    const k = spans.findIndex((s) => s.intermediates.includes(rowIndex));
    const s = spans[k]!;
    const read = s.intermediates.filter((i) => rows[i]!.foresight != null).length;
    return {
      k,
      rowIndex,
      text: `Armada ${k + 1}: ${read} de ${s.intermediates.length} puntos leídos. Falta desde ${code}.`,
    };
  }
  // La V− que falta es de la armada que la fila cierra; la V+, de la que abre.
  const closes = spans.findIndex((s) => s.closer === rowIndex);
  if (!isStart(rows, rowIndex) && row.foresight == null && closes >= 0) {
    return { k: closes, rowIndex, text: `Armada ${closes + 1}: falta la vista adelante a ${code}.` };
  }
  const k = spans.findIndex((s) => s.opener === rowIndex);
  return { k: Math.max(k, 0), rowIndex, text: `Armada ${Math.max(k, 0) + 1}: falta la vista atrás a ${code}.` };
}

export interface PointMovement {
  pointId: string;
  code: string;
  /** mm desde la lectura anterior del punto; null en su línea base. */
  partialMm: number | null;
  /** Días desde esa lectura; null en su línea base. */
  days: number | null;
  /** El aviso de tendencia (Fase 12), en una frase; null si no hay. */
  warning: string | null;
}

const mm = (v: number) => Math.abs(v).toFixed(1);

/**
 * El movimiento de cada punto de la visita desde la anterior (decisión 20),
 * con el aviso de tendencia del margen fijo (decisión 17). Solo los puntos
 * con lectura en la visita, en el orden de `points`.
 */
export function pointMovements(
  visits: readonly VisitResult[],
  visitId: string,
  points: readonly { id: string; code: string }[],
): PointMovement[] {
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));
  const at = ordered.findIndex((v) => v.visitId === visitId);
  const visit = ordered[at];
  if (!visit) return [];
  const deviations = detectTrendDeviations([...visits]).get(visitId);
  return points.flatMap((p) => {
    const reading = visit.readings.find((x) => x.pointId === p.id);
    if (!reading) return [];
    const previous = ordered
      .slice(0, at)
      .reverse()
      .find((v) => v.readings.some((x) => x.pointId === p.id));
    const days = reading.partialSettlement != null && previous ? daysBetween(previous.date, visit.date) : null;
    const d = deviations?.get(p.id);
    const code = p.code.trim();
    let warning: string | null = null;
    if (d) {
      const verb = d.partialMm > 0 ? "subió" : "bajó";
      const span = days != null ? ` en ${days} ${days === 1 ? "día" : "días"}` : "";
      const came =
        d.previousVelocity === 0
          ? "venía estable"
          : `venía ${d.previousVelocity > 0 ? "subiendo" : "bajando"} ${mm(d.previousVelocity)} mm/mes`;
      warning =
        d.kind === "excessive"
          ? `${code} ${verb} ${mm(d.partialMm)} mm${span}; a su ritmo anterior serían unos ${mm(d.expectedMm)} mm.`
          : `${code} ${verb} ${mm(d.partialMm)} mm${span}; ${came}.`;
    }
    return [{ pointId: p.id, code, partialMm: reading.partialSettlement, days, warning }];
  });
}

/** El código de un BM del lugar, si lo es. */
export function benchmarkNamed<T extends { code: string }>(benchmarks: readonly T[], code: string): T | undefined {
  return benchmarks.find((b) => samePointCode(b.code, code));
}
