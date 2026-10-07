// Validación de la libreta de nivelación de una visita (Fases 18 y 37).
//
// Cada fila pasa las reglas de captura de la nivelación
// (`validateReadingCapture`); lo propio de la visita es que cada tramo arranca
// en un BM del lugar y que la distancia es opcional. Lo que falta por leer no
// es error: la visita se guarda en medición.

import { resolveVisualDistances, samePointCode } from "@/lib/calculations/leveling";
import { formatSignedMm } from "@/lib/utils/format";
import { validateReadingCapture, type ReadingCaptureIssues } from "./leveling";
import type { BookRowInput as VisitBookRowInput } from "@/lib/calculations/settlement-book";
import type { BenchmarkCheck, BenchmarkInput, BookIssue } from "@/types/settlement";

export interface VisitBookIssues {
  /** Issues por celda, en el orden de las filas (los de nivelación más los del amarre). */
  rowIssues: ReadingCaptureIssues[];
  /** Errores de la libreta entera, que no pertenecen a una celda. */
  errors: string[];
}

/**
 * Valida la libreta de una visita (Fase 37): cada tramo arranca en un BM del
 * lugar y cada fila pasa las reglas de captura de la nivelación. Lo que falta
 * por leer no es error: la visita se guarda en medición.
 */
export function validateBook(
  rows: readonly VisitBookRowInput[],
  benchmarks: readonly BenchmarkInput[],
): VisitBookIssues {
  if (rows.length === 0) return { rowIssues: [], errors: [] };
  const errors: string[] = [];
  const numeric = ["backsight", "foresight", "backUpperM", "backLowerM", "foreUpperM", "foreLowerM", "backDistanceM", "foreDistanceM"] as const;
  if (rows.some((r) => numeric.some((k) => r[k] != null && !Number.isFinite(r[k])))) {
    errors.push("La libreta tiene un valor que no es un número.");
  }
  let armada = 0;
  rows.forEach((row, i) => {
    const starts = i === 0 || row.startsSection;
    if (starts || (row.pointType === "pc" && i !== rows.length - 1)) armada++;
    if (starts && !benchmarks.some((b) => samePointCode(b.code, row.pointCode))) {
      errors.push(`La armada ${armada} sale de ${row.pointCode.trim()}, que no está en los BM del lugar.`);
    }
  });
  // En la visita la distancia es opcional (Fase 37, alcance D): sin ella el
  // tramo no acumula y queda sin orden, pero la cota de cada punto no cambia.
  // Una distancia tecleada sigue sin poder ser cero.
  const rowIssues = rows.map((row) => {
    const issues = validateReadingCapture(row);
    const { back, fore } = resolveVisualDistances(row);
    if (back == null) delete issues.errors.backDistanceM;
    if (fore == null) delete issues.errors.foreDistanceM;
    return issues;
  });
  return { rowIssues, errors };
}

/** El mensaje de un hallazgo de la derivación, con las filas numeradas desde 1. */
export function bookIssueMessage(issue: BookIssue): string {
  switch (issue.kind) {
    case "duplicate":
      return `${issue.code} tiene vista menos en las filas ${issue.rows
        .map((r) => r + 1)
        .join(" y ")}: deja solo una.`;
    case "inactive":
      return `${issue.code} no está vigente en la fecha de la visita: su lectura (fila ${issue.row + 1}) no se usa.`;
    case "missing":
      return `${issue.code} no tiene vista menos en la libreta: queda sin cota.`;
  }
}

/**
 * El mensaje de la comprobación de un BM de control (Fase 30). Si no nivela,
 * da las dos cotas y no culpa a ninguno de los dos BM: con dos no se sabe cuál
 * se movió, y una cota de catálogo mal tecleada da el mismo síntoma.
 */
export function benchmarkCheckMessage(check: BenchmarkCheck, amarreCode: string): string {
  const amarre = amarreCode.trim();
  const diferencia = `${formatSignedMm(check.differenceMm)} mm`;
  if (check.toleranceMm == null || check.meetsTolerance == null) {
    return `${check.code} frente a ${amarre}: ${diferencia}. Sin distancias por visual no se evalúa la tolerancia.`;
  }
  const tolerancia = `tolerancia ${check.toleranceMm.toFixed(1)} mm`;
  if (check.meetsTolerance) {
    return `${check.code} nivela con ${amarre}: ${diferencia}, ${tolerancia}.`;
  }
  return (
    `${check.code} no nivela con ${amarre}: la libreta lo da en ${check.measuredElevation.toFixed(4)} ` +
    `y el catálogo en ${check.catalogElevation.toFixed(4)} (${diferencia}, ${tolerancia}). ` +
    "Uno de los dos BM pudo moverse, o hay un error en la libreta o en la cota del catálogo."
  );
}
