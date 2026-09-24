// Validación de la libreta de nivelación de una visita (Fase 18).
//
// La libreta de la visita es una libreta de nivelación más —un circuito
// cerrado—, así que hereda todas las reglas de captura de nivelación
// (`validateRunCapture`). Lo que se añade aquí es lo propio de la visita: el
// circuito arranca y cierra en el BM de amarre, cuya cota es obligatoria. Ver
// docs/prds/17-libreta-panel-asentamientos.md, «Validación».

import { samePointCode } from "@/lib/calculations/leveling";
import {
  validateRunCapture,
  type ReadingCaptureIssues,
} from "./leveling";
import type { ReadingInput as BookRowInput } from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";
import type { BookIssue } from "@/types/settlement";

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
  order: PrecisionOrder,
): VisitBookIssues {
  if (rows.length === 0) return { rowIssues: [], errors: [] };

  const errors: string[] = [];
  const code = amarre.code.trim();
  if (code === "") errors.push("Falta el BM de amarre de la visita.");
  else if (amarre.elevation == null) errors.push("Falta la cota del BM de amarre.");
  if (rows.length < 2) {
    errors.push("La libreta necesita al menos la fila del amarre y la de cierre.");
  }

  const rowIssues = validateRunCapture(rows, "closed", order, false);
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
      return `${issue.code} no aparece en la libreta.`;
  }
}
