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

/**
 * ¿La cadena es una fecha ISO `YYYY-MM-DD` que además existe en el calendario?
 *
 * El regex por sí solo no basta: `2025-02-30` tiene la forma correcta y
 * `Date.parse` la reinterpreta en silencio como `2025-03-02`, desplazando el
 * intervalo entre visitas y con él la velocidad calculada. El round-trip
 * detecta ese desplazamiento porque la fecha reconstruida ya no coincide con
 * la de entrada.
 */
function isCalendarDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

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

  if (!isCalendarDate(visit.date)) {
    errors.date = "La visita necesita una fecha válida.";
  } else if (previousVisitDate !== null && visit.date <= previousVisitDate) {
    errors.date = `La fecha debe ser posterior a la de la visita anterior (${previousVisitDate}).`;
  }

  const byId = new Map(points.map((p) => [p.id, p]));
  const seen = new Set<string>();
  // Varios problemas pueden coexistir en la misma visita (un fantasma y un
  // duplicado a la vez); se acumulan en vez de sobrescribirse para no perder
  // el diagnóstico del primero.
  const readingMessages: string[] = [];

  for (const reading of visit.readings) {
    const point = byId.get(reading.pointId);
    if (!point) {
      readingMessages.push(
        "Hay una lectura de un punto que no está en el catálogo.",
      );
      continue;
    }
    if (seen.has(reading.pointId)) {
      readingMessages.push(
        `El punto ${point.code} tiene más de una lectura en esta visita.`,
      );
      continue;
    }
    seen.add(reading.pointId);
    readingIssues[reading.pointId] = validateReadingCapture(reading, point);
  }

  if (readingMessages.length > 0) {
    errors.readings = readingMessages.join(" ");
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
 * También repite la comprobación de orden cronológico de `validateVisitCapture`
 * (vía `previousVisitDate`): el cierre sella la visita como inmutable, así que
 * es el último punto donde una fecha fuera de orden puede atajarse. Sin este
 * chequeo se podría cerrar con el mismo dato que la captura ya habría
 * rechazado, dejando un intervalo negativo grabado para siempre.
 *
 * NO evalúa los umbrales de alerta. Un punto en alarma se cierra con
 * normalidad; es el hallazgo que el monitoreo busca documentar.
 */
export function validateVisitClose(
  visit: VisitInput,
  points: PointInput[],
  previousVisitDate: string | null,
): VisitCaptureIssues {
  const issues = validateVisitCapture(visit, points, previousVisitDate);

  const measured = new Set(visit.readings.map((r) => r.pointId));
  const missing = points.filter((p) => !measured.has(p.id));

  if (missing.length > 0) {
    const missingMessage = `Faltan lecturas de: ${missing
      .map((p) => p.code)
      .join(", ")}.`;
    issues.errors.readings = issues.errors.readings
      ? `${issues.errors.readings} ${missingMessage}`
      : missingMessage;
  }

  return issues;
}
