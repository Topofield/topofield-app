// Validación del control de asentamientos — funciones puras (PRD § 5.1 capa de
// captura). Sin React, sin Supabase. Desde la Fase 37 no hay capa de cierre.
//
// La capa estadística (§ 5.3) NO vive aquí y NO bloquea: un asentamiento en
// alarma es un hallazgo del monitoreo, no un error de captura. Su cálculo está
// en src/lib/calculations/settlement.ts y su presentación en el semáforo.

import { isPointActiveOn } from "@/lib/calculations/settlement";
import { formatDateOnly } from "@/lib/utils/format";
import type { PointInput, ReadingInput, VisitInput } from "@/types/settlement";

/** Issues de una lectura, indexados por celda de la tabla. */
export interface ReadingCaptureIssues {
  errors: Partial<Record<"elevation", string>>;
  warnings: Partial<Record<"elevation", string>>;
}

/** Issues de la visita completa, más los de cada lectura por punto. */
export interface VisitCaptureIssues {
  /** `book`: la libreta de la visita (Fase 18), solo al cerrar. */
  errors: Partial<Record<"date" | "readings" | "book", string>>;
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
export function isCalendarDate(value: string): boolean {
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
 * Las fechas de las visitas vecinas de una, por número: la anterior y la
 * siguiente, o `null` (Fase 26, C-16). El número se asigna en orden de fecha
 * —una visita nueva va después de la última—, así que la fecha de una visita
 * tiene que quedar entre las de sus vecinas. Antes se comparaba solo con la
 * última de fecha estrictamente anterior, y una visita podía igualar la fecha
 * de otra o saltar por encima de ella, cambiando su parcial y su velocidad.
 */
export function neighborVisitDates(
  visit: Pick<VisitInput, "visitNumber">,
  visits: readonly Pick<VisitInput, "visitNumber" | "date">[],
): { previous: string | null; next: string | null } {
  let previous: Pick<VisitInput, "visitNumber" | "date"> | null = null;
  let next: Pick<VisitInput, "visitNumber" | "date"> | null = null;
  for (const v of visits) {
    if (v.visitNumber < visit.visitNumber && (!previous || v.visitNumber > previous.visitNumber)) {
      previous = v;
    }
    if (v.visitNumber > visit.visitNumber && (!next || v.visitNumber < next.visitNumber)) {
      next = v;
    }
  }
  return { previous: previous?.date ?? null, next: next?.date ?? null };
}

/**
 * Valida la captura de una visita completa (§ 5.1).
 *
 * `previousVisitDate` y `nextVisitDate` son las fechas de las visitas vecinas
 * (`neighborVisitDates`), o `null`. La fecha tiene que quedar estrictamente
 * entre las dos: antes de la anterior daría intervalos negativos y velocidades
 * con el signo invertido; igual a otra deja el intervalo en cero; después de la
 * siguiente reordena la serie y cambia el parcial de las demás.
 */
export function validateVisitCapture(
  visit: VisitInput,
  points: PointInput[],
  previousVisitDate: string | null,
  nextVisitDate: string | null = null,
): VisitCaptureIssues {
  const errors: VisitCaptureIssues["errors"] = {};
  const warnings: VisitCaptureIssues["warnings"] = {};
  const readingIssues: Record<string, ReadingCaptureIssues> = {};

  if (!isCalendarDate(visit.date)) {
    errors.date = "La visita necesita una fecha válida.";
  } else if (previousVisitDate !== null && visit.date <= previousVisitDate) {
    errors.date = `La fecha debe ser posterior a la de la visita anterior (${previousVisitDate}).`;
  } else if (nextVisitDate !== null && visit.date >= nextVisitDate) {
    errors.date = `La fecha debe ser anterior a la de la visita siguiente (${nextVisitDate}).`;
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
    // Vigencia (Fase 11). Cubre también cambiar la fecha de una visita
    // abierta hasta sacarla de la vigencia de un punto ya medido: la fecha y
    // las lecturas se validan juntas.
    if (isCalendarDate(visit.date) && !isPointActiveOn(point, visit.date)) {
      readingMessages.push(outsideValidityMessage(point, visit.date));
    }
  }

  if (readingMessages.length > 0) {
    errors.readings = readingMessages.join(" ");
  }

  return { errors, warnings, readingIssues };
}

/** Por qué un punto no admite lectura en una fecha. */
function outsideValidityMessage(point: PointInput, date: string): string {
  if (point.retiredOn !== null && date >= point.retiredOn) {
    return `${point.code} está de baja desde el ${formatDateOnly(point.retiredOn)}; no admite lecturas en esta visita.`;
  }
  return `${point.code} se dio de alta el ${formatDateOnly(point.activeFrom ?? date)}; no admite lecturas en una visita anterior.`;
}

// ============================================================================
// Estado de los BMs: dar de baja, deshacer la baja, dar de alta (Fase 11).
// Reglas puras; las Server Actions de `point-actions.ts` las aplican.
// ============================================================================

/**
 * ¿Se puede dar de baja el punto con esta fecha y este motivo?
 *
 * `retiredOn` es la primera fecha en que ya no se mide, así que debe ser
 * POSTERIOR a su última lectura, en cualquier visita: si no, esa lectura
 * quedaría fuera de vigencia (y el trigger de la base la
 * rechazaría igualmente).
 */
export function validateRetirement(input: {
  retiredOn: string;
  reason: string;
  activeFrom: string | null;
  lastReadingDate: string | null;
}): string | null {
  if (!isCalendarDate(input.retiredOn)) {
    return "La baja necesita una fecha válida.";
  }
  if (input.reason.trim() === "") {
    return "Indica el motivo de la baja.";
  }
  if (input.activeFrom !== null && input.retiredOn <= input.activeFrom) {
    return `La fecha de baja debe ser posterior al alta (${formatDateOnly(input.activeFrom)}).`;
  }
  if (input.lastReadingDate !== null && input.retiredOn <= input.lastReadingDate) {
    return `La fecha de baja debe ser posterior a su última lectura (${formatDateOnly(input.lastReadingDate)}).`;
  }
  return null;
}

/**
 * ¿Es válida la fecha de alta de un punto nuevo? Desde la Fase 37 ninguna
 * visita se cierra, así que cualquier fecha de calendario sirve: las visitas
 * posteriores lo esperan como pendiente.
 */
export function validateActiveFrom(activeFrom: string): string | null {
  return isCalendarDate(activeFrom) ? null : "El punto necesita una fecha de alta válida.";
}

/**
 * ¿Cambia la C0 del punto (Fase 23)? Se compara a la escala de la base, cotas
 * a 4 decimales: el formulario devuelve el valor formateado, y un `100.12` que
 * vuelve como `100.1200` no es un cambio.
 */
export function pointReferenceChanged(
  current: { initial_elevation: number | null },
  next: { initialElevation: number | null },
): boolean {
  const a = current.initial_elevation;
  const b = next.initialElevation;
  return a === null || b === null ? a !== b : a.toFixed(4) !== b.toFixed(4);
}
