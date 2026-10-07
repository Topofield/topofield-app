// Validación de la libreta de nivelación de una visita (Fase 18).
//
// La libreta de la visita es una libreta de nivelación más —un circuito
// cerrado—, así que hereda todas las reglas de captura de nivelación
// (`validateRunCapture`). Lo que se añade aquí es lo propio de la visita: el
// circuito arranca y cierra en el BM de amarre, cuya cota es obligatoria. Ver
// docs/prds/17-libreta-panel-asentamientos.md, «Validación».

import { samePointCode } from "@/lib/calculations/leveling";
import { formatSignedMm } from "@/lib/utils/format";
import {
  validateReadingCapture,
  validateRunCapture,
  type ReadingCaptureIssues,
} from "./leveling";
import type { BookRowInput as VisitBookRowInput } from "@/lib/calculations/settlement-book";
import type { ReadingInput as BookRowInput } from "@/types/leveling";
import type { BenchmarkCheck, BenchmarkInput, BookIssue } from "@/types/settlement";

export interface VisitBookIssues {
  /** Issues por celda, en el orden de las filas (los de nivelación más los del amarre). */
  rowIssues: ReadingCaptureIssues[];
  /** Errores de la libreta entera, que no pertenecen a una celda. */
  errors: string[];
}

/**
 * Valida la libreta de una visita. Una libreta vacía no exige nada: la visita
 * puede guardarse en borrador antes de salir a campo.
 */
export function validateVisitBook(
  rows: BookRowInput[],
  amarre: { code: string; elevation: number | null },
): VisitBookIssues {
  if (rows.length === 0) return { rowIssues: [], errors: [] };

  const errors: string[] = [];
  const code = amarre.code.trim();
  if (code === "") errors.push("Falta el BM de amarre de la visita.");
  else if (amarre.elevation == null) errors.push("Falta la cota del BM de amarre.");
  if (rows.length < 2) {
    errors.push("La libreta necesita al menos la fila del amarre y la de cierre.");
  }

  // Un número no finito no llega desde el editor, pero sí en una llamada
  // directa a la acción: el protocolo de las Server Actions transporta `NaN`,
  // el validador de nivelación no lo filtra (sus comparaciones con `NaN` son
  // falsas) y Postgres lo acepta en una columna `numeric`.
  const numeric = [
    "backsight", "foresight", "backUpperM", "backLowerM",
    "foreUpperM", "foreLowerM", "backDistanceM", "foreDistanceM",
  ] as const;
  if (
    (amarre.elevation != null && !Number.isFinite(amarre.elevation)) ||
    rows.some((r) => numeric.some((k) => r[k] != null && !Number.isFinite(r[k])))
  ) {
    errors.push("La libreta tiene un valor que no es un número.");
  }

  const rowIssues = validateRunCapture(rows, "closed");
  if (code !== "" && rows.length >= 2) {
    const last = rows.length - 1;
    const first = rowIssues[0]!;
    if (!samePointCode(rows[0]!.pointCode, code)) {
      first.errors = {
        ...first.errors,
        pointCode: `La libreta arranca en el BM de amarre (${code}).`,
      };
    }
    if (rows[0]!.pointType !== "bm") {
      first.errors = { ...first.errors, pointType: "El amarre es de tipo BM." };
    }
    if (!samePointCode(rows[last]!.pointCode, code)) {
      const closing = rowIssues[last]!;
      closing.errors = {
        ...closing.errors,
        pointCode: `La libreta cierra en el BM de amarre (${code}).`,
      };
    }
  }

  return { rowIssues, errors };
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
  const rowIssues = rows.map((row) => validateReadingCapture(row));
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
