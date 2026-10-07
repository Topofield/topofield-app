// Lo que se guarda de una visita (Fase 37): de su libreta, los BM del lugar y
// los puntos sale todo —cotas, verificación, estado y filas—. Lo usan la
// acción de guardar, el recálculo del lugar, el script de resincronización y
// la demo: una sola regla para todos (aprendizaje de la Fase 36).
//
// Funciones puras: sin React, sin Supabase.

import { samePointCode } from "./leveling";
import { computeHistory } from "./settlement";
import {
  bookElevations,
  bookRowInputOf,
  bookVerification,
  computeBook,
  visitStatusOf,
} from "./settlement-book";
import { bookRowsToPersist } from "./settlement-persistence";
import type { PrecisionOrder } from "@/types/project";
import type {
  BenchmarkInput,
  BookIssue,
  BookRowPayload,
  ComputedReading,
  DerivedElevation,
  PointInput,
  Thresholds,
  VisitBook,
  VisitVerification,
} from "@/types/settlement";

export interface VisitRecordInput {
  visitId: string;
  date: string;
  rows: BookRowPayload[];
  points: PointInput[];
  benchmarks: BenchmarkInput[];
}

/** Las columnas de `settlement_visits` que salen de la libreta. */
export interface VisitRecordHeader {
  /** El BM del lugar donde arranca el primer tramo. */
  reference_bm_code: string | null;
  reference_bm_elevation: number | null;
  /** El cierre, la tolerancia y el «cumple» del tramo peor, si se verifica. */
  closure_error_mm: number | null;
  tolerance_mm: number | null;
  meets_tolerance: boolean | null;
  total_distance_km: number | null;
  /** El orden de la visita: el más bajo de sus tramos; null si alguno no se verifica. */
  precision_order: PrecisionOrder | null;
  status: "draft" | "in_progress" | "calculated";
}

export interface VisitRecord {
  book: VisitBook;
  verification: VisitVerification;
  elevations: DerivedElevation[];
  issues: BookIssue[];
  header: VisitRecordHeader;
  /** Las filas de `settlement_book_readings`, listas para `save_visit`. */
  rows: ReturnType<typeof bookRowsToPersist>;
}

export interface SiteVisitInput {
  id: string;
  visitNumber: number;
  date: string;
  rows: BookRowPayload[];
  /**
   * Las cotas guardadas, para una visita sin libreta (las de cotas tecleadas
   * anteriores a la Fase 37): entran al histórico tal cual.
   */
  elevations?: { pointId: string; elevation: number }[];
}

const round = (v: number | null, d: number) =>
  v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d));

export function visitRecordOf({ visitId, date, rows, points, benchmarks }: VisitRecordInput): VisitRecord {
  const inputs = rows.map(bookRowInputOf);
  const book = computeBook(inputs, benchmarks);
  const verification = bookVerification(book);
  const { readings: elevations, issues } = bookElevations(book, inputs, points, date);
  const first = book.tramos[0];
  const worst = verification.worst;
  const closes = worst != null && worst.kind !== "open" && worst.complete;
  // La cota del BM del lugar en su fila, como la copiaba la Fase 30; un punto
  // de control con el mismo código manda, como en `bookElevations`.
  const benchmarkElevations = rows.map((row) =>
    points.some((p) => samePointCode(p.code, row.pointCode))
      ? null
      : (benchmarks.find((b) => samePointCode(b.code, row.pointCode))?.elevation ?? null),
  );
  return {
    book,
    verification,
    elevations,
    issues,
    header: {
      reference_bm_code: first?.startCode ?? null,
      reference_bm_elevation: first?.startElevation ?? null,
      closure_error_mm: closes ? worst!.closureMm : null,
      tolerance_mm: closes ? worst!.toleranceMm : null,
      meets_tolerance: verification.verified ? true : closes ? false : null,
      total_distance_km: round(verification.distanceKm, 3),
      precision_order: verification.order,
      status: visitStatusOf(rows),
    },
    rows: bookRowsToPersist(visitId, rows, book.readings, points, benchmarkElevations),
  };
}

/**
 * Todas las visitas de un lugar recalculadas desde su libreta (Fase 37): el
 * registro de cada una y sus lecturas en el histórico. Lo usan el cambio de la
 * cota de un BM (decisión 13) y la resincronización tras dejar de compensar.
 */
export function recalculateSite({
  points,
  benchmarks,
  thresholds,
  visits,
}: {
  points: PointInput[];
  benchmarks: BenchmarkInput[];
  thresholds: Thresholds;
  visits: SiteVisitInput[];
}): { visitId: string; record: VisitRecord; readings: ComputedReading[] }[] {
  const records = visits.map((visit) => ({
    visit,
    record: visitRecordOf({ visitId: visit.id, date: visit.date, rows: visit.rows, points, benchmarks }),
  }));
  const history = computeHistory(
    points,
    records.map(({ visit, record }) => ({
      id: visit.id,
      visitNumber: visit.visitNumber,
      date: visit.date,
      readings:
        visit.rows.length > 0
          ? record.elevations.map(({ pointId, elevation }) => ({ pointId, elevation }))
          : (visit.elevations ?? []),
    })),
    thresholds,
  );
  return records.map(({ visit, record }) => ({
    visitId: visit.id,
    record,
    readings: history.visits.find((h) => h.visitId === visit.id)?.readings ?? [],
  }));
}
