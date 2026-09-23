// Validación del control de asentamientos — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// La capa estadística (§ 5.3) NO vive aquí y NO bloquea: un asentamiento en
// alarma es un hallazgo del monitoreo, no un error de captura. Su cálculo está
// en src/lib/calculations/settlement.ts y su presentación en el semáforo.

import { isPointActiveOn } from "@/lib/calculations/settlement";
import { formatDateOnly } from "@/lib/utils/format";
import type { PointInput, ReadingInput, VisitInput } from "@/types/settlement";

/** Una visita del lugar con su estado, para las reglas que miran el histórico. */
export interface SiteVisit extends VisitInput {
  closed: boolean;
}

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

/**
 * Valida que una visita pueda cerrarse (§ 5.2).
 *
 * Exige que todos los puntos **vigentes** en la fecha de la visita tengan
 * lectura: una visita cerrada es el registro inmutable de una fecha, y
 * cerrarla incompleta deja un hueco que ya no se puede rellenar. Un punto de
 * baja o todavía no dado de alta no se exige (Fase 11).
 *
 * `siteVisits` son las visitas del lugar con su estado, para la regla de la
 * línea base: una visita no se cierra si alguno de sus puntos sin C0 tiene la
 * primera lectura —su línea base— en una visita ANTERIOR todavía abierta. Si
 * se cerrara, editar esa lectura abierta cambiaría el acumulado que el panel
 * recalcula en vivo para esta visita, que ya sería inmutable. Ver el PRD de la
 * Fase 11, «Por qué la línea base no puede quedar abierta».
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
  siteVisits: readonly SiteVisit[],
): VisitCaptureIssues {
  const issues = validateVisitCapture(visit, points, previousVisitDate);
  const messages: string[] = [];

  const measured = new Set(visit.readings.map((r) => r.pointId));
  const missing = points.filter(
    (p) => isPointActiveOn(p, visit.date) && !measured.has(p.id),
  );
  if (missing.length > 0) {
    messages.push(`Faltan lecturas de: ${missing.map((p) => p.code).join(", ")}.`);
  }

  const byId = new Map(points.map((p) => [p.id, p]));
  const others = siteVisits.filter((v) => v.id !== visit.id);
  for (const pointId of measured) {
    const point = byId.get(pointId);
    if (!point || point.initialElevation !== null) continue;

    const baselineVisit = others
      .filter((v) => v.date < visit.date && v.readings.some((r) => r.pointId === pointId))
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (baselineVisit && !baselineVisit.closed) {
      messages.push(
        `Cierra antes la visita ${baselineVisit.visitNumber}: contiene la primera lectura de ${point.code}, que es su línea base.`,
      );
    }
  }

  if (messages.length > 0) {
    const text = messages.join(" ");
    issues.errors.readings = issues.errors.readings
      ? `${issues.errors.readings} ${text}`
      : text;
  }

  return issues;
}

// ============================================================================
// Estado de los BMs: dar de baja, deshacer la baja, dar de alta (Fase 11).
// Reglas puras; las Server Actions de `point-actions.ts` las aplican.
// ============================================================================

/**
 * ¿Se puede dar de baja el punto con esta fecha y este motivo?
 *
 * `retiredOn` es la primera fecha en que ya no se mide, así que debe ser
 * POSTERIOR a su última lectura, en cualquier visita, abierta o cerrada: si
 * no, esa lectura quedaría fuera de vigencia (y el trigger de la base la
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
    return "Indica el motivo de la baja: dentro de un año nadie recordará por qué el punto dejó de medirse.";
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
 * ¿Se puede deshacer la baja? Solo para corregir un error: mientras ninguna
 * visita CERRADA tenga fecha igual o posterior a la baja. Después es
 * definitiva — un BM reencontrado puede haberse movido, y vuelve como punto
 * nuevo con otro código.
 *
 * Devuelve el motivo del rechazo, nombrando la visita que la hace definitiva,
 * o null si se puede.
 */
export function undoRetirementBlocker(
  retiredOn: string,
  closedVisits: readonly { visitNumber: number; date: string }[],
): string | null {
  const blocking = closedVisits
    .filter((v) => v.date >= retiredOn)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!blocking) return null;
  return `La baja ya es definitiva: la visita ${blocking.visitNumber} (${formatDateOnly(blocking.date)}), posterior a la baja, está cerrada.`;
}

/**
 * ¿Es válida la fecha de alta de un punto nuevo?
 *
 * Debe ser POSTERIOR a la última visita cerrada del lugar: esa visita se
 * cerró sin el punto, y darlo de alta antes la dejaría incompleta a
 * posteriori.
 */
export function validateActiveFrom(
  activeFrom: string,
  lastClosedVisitDate: string | null,
): string | null {
  if (!isCalendarDate(activeFrom)) {
    return "El punto necesita una fecha de alta válida.";
  }
  if (lastClosedVisitDate !== null && activeFrom <= lastClosedVisitDate) {
    return `La fecha de alta debe ser posterior a la última visita cerrada (${formatDateOnly(lastClosedVisitDate)}).`;
  }
  return null;
}
