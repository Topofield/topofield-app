// Validación del control de asentamientos — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// La capa estadística (§ 5.3) NO vive aquí y NO bloquea: un asentamiento en
// alarma es un hallazgo del monitoreo, no un error de captura. Su cálculo está
// en src/lib/calculations/settlement.ts y su presentación en el semáforo.

import type { PointInput, ReadingInput, VisitInput } from "@/types/settlement";

/** Issues de una lectura, indexados por celda de la tabla. */
export interface ReadingCaptureIssues {
  errors: Partial<Record<"elevation", string>>;
  warnings: Partial<Record<"elevation", string>>;
}

/** Issues de la visita completa, más los de cada lectura por punto. */
export interface VisitCaptureIssues {
  errors: Partial<Record<"date" | "readings", string>>;
  warnings: Partial<Record<"date" | "readings", string>>;
  readingIssues: Record<string, ReadingCaptureIssues>;
}

/**
 * Desviación máxima plausible de una cota respecto a su C0, en metros.
 *
 * Un metro de asentamiento no ocurre en monitoreo topográfico; a esa escala lo
 * habitual es un error de transcripción (una cifra de más, un dígito cambiado).
 * Es advertencia y no error: el dato podría ser real en un terraplén sobre
 * turba, y bloquearlo impediría registrar justo el caso extremo.
 */
const MAX_PLAUSIBLE_DEVIATION_M = 1;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Valida la cota medida de un punto en una visita (§ 5.1). */
export function validateReadingCapture(
  reading: ReadingInput,
  point: PointInput,
): ReadingCaptureIssues {
  const errors: ReadingCaptureIssues["errors"] = {};
  const warnings: ReadingCaptureIssues["warnings"] = {};

  if (!Number.isFinite(reading.elevation)) {
    errors.elevation = "La cota es obligatoria y debe ser un número.";
  } else if (
    point.initialElevation !== null &&
    Math.abs(reading.elevation - point.initialElevation) >
      MAX_PLAUSIBLE_DEVIATION_M
  ) {
    warnings.elevation =
      "La cota se aleja más de 1 m de la línea base. Verifica la transcripción.";
  }

  return { errors, warnings };
}

/**
 * Valida la captura de una visita completa (§ 5.1).
 *
 * `previousVisitDate` es la fecha de la visita cronológicamente anterior, o
 * `null` si es la primera. Sirve para impedir que una visita se feche antes que
 * su predecesora, lo que daría intervalos negativos y velocidades con el signo
 * invertido.
 */
export function validateVisitCapture(
  visit: VisitInput,
  points: PointInput[],
  previousVisitDate: string | null,
): VisitCaptureIssues {
  const errors: VisitCaptureIssues["errors"] = {};
  const warnings: VisitCaptureIssues["warnings"] = {};
  const readingIssues: Record<string, ReadingCaptureIssues> = {};

  if (!ISO_DATE_RE.test(visit.date)) {
    errors.date = "La visita necesita una fecha válida.";
  } else if (previousVisitDate !== null && visit.date <= previousVisitDate) {
    errors.date = `La fecha debe ser posterior a la de la visita anterior (${previousVisitDate}).`;
  }

  const byId = new Map(points.map((p) => [p.id, p]));
  const seen = new Set<string>();

  for (const reading of visit.readings) {
    const point = byId.get(reading.pointId);
    if (!point) {
      errors.readings = "Hay una lectura de un punto que no está en el catálogo.";
      continue;
    }
    if (seen.has(reading.pointId)) {
      errors.readings = `El punto ${point.code} tiene más de una lectura en esta visita.`;
      continue;
    }
    seen.add(reading.pointId);
    readingIssues[reading.pointId] = validateReadingCapture(reading, point);
  }

  return { errors, warnings, readingIssues };
}

/**
 * Valida que una visita pueda cerrarse (§ 5.2).
 *
 * Exige que todos los puntos del catálogo tengan lectura: una visita cerrada es
 * el registro inmutable de una fecha, y cerrarla incompleta deja un hueco que
 * ya no se puede rellenar.
 *
 * NO evalúa los umbrales de alerta. Un punto en alarma se cierra con
 * normalidad; es el hallazgo que el monitoreo busca documentar.
 */
export function validateVisitClose(
  visit: VisitInput,
  points: PointInput[],
): VisitCaptureIssues {
  const issues = validateVisitCapture(visit, points, null);

  const measured = new Set(visit.readings.map((r) => r.pointId));
  const missing = points.filter((p) => !measured.has(p.id));

  if (missing.length > 0) {
    issues.errors.readings = `Faltan lecturas de: ${missing
      .map((p) => p.code)
      .join(", ")}.`;
  }

  return issues;
}
