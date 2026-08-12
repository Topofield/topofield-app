// Validación del proceso de nivelación — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// Forma del resultado: sigue el patrón de `polygonal.ts` (Fase 3) — un
// `Record` por celda (`errors` / `warnings` indexados por campo) en vez del
// `ValidationIssue[]` propuesto en el brief de la tarea. El editor pinta cada
// celda de la libreta según su propio estado y así se consulta directo
// (`issues.errors.backsight`) sin recorrer un array filtrando por `field`.

import type { LevelingResult, PointType, ReadingInput } from "@/types/leveling";

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

/** Issues de captura de una lectura, indexados por celda de la libreta. */
export interface ReadingCaptureIssues {
  errors: Partial<
    Record<"pointCode" | "backsight" | "foresight" | "distanceAccumulatedKm", string>
  >;
  warnings: Partial<Record<"backsight" | "foresight", string>>;
}

/** Rango físico de una lectura de mira, en metros (§ 5.1). */
const MIN_READING = 0;
const MAX_READING = 4;

// El equilibrado de visuales (|d_atrás − d_adelante| ≤ 2/3/4/6 m según orden)
// NO se valida aquí: es una propiedad de la armada, que compara la distancia a
// la mira de atrás con la de adelante, y `distanceM` guarda un solo valor por
// fila. Validarlo exigiría capturar ambas distancias por armada — un cambio de
// modelo de datos que no entra en esta fase. Se registra como deuda técnica.

/**
 * Tipos de punto que entran en la comprobación aritmética y en la
 * compensación (§ 5.1). Los `intermediate` cuelgan de la AI vigente y quedan
 * fuera de ambas, así que no exigen distancia acumulada.
 */
function requiresDistanceAccumulated(pointType: PointType): boolean {
  return pointType !== "intermediate";
}

/**
 * Valida la captura de una lectura de la libreta de nivelación.
 */
export function validateReadingCapture(
  reading: ReadingInput,
): ReadingCaptureIssues {
  const errors: ReadingCaptureIssues["errors"] = {};
  const warnings: ReadingCaptureIssues["warnings"] = {};

  if (reading.pointCode.trim() === "") {
    errors.pointCode = "El punto necesita un código.";
  }

  // La distancia acumulada es obligatoria en bm y pc porque la corrección
  // proporcional la usa como peso. Un null se compensaría como 0 — es decir,
  // sin corrección — y el punto de cierre quedaría descompensado en silencio,
  // con el proceso reportando que cumple la tolerancia. Medido en la Tarea 5:
  // el BM final cerraba en 99.992 en vez de 100.000, con los −8 mm intactos.
  // Los `intermediate` sí pueden traerla nula: no entran en la compensación.
  if (
    requiresDistanceAccumulated(reading.pointType) &&
    reading.distanceAccumulatedKm == null
  ) {
    errors.distanceAccumulatedKm =
      "La distancia acumulada es obligatoria: sin ella el punto no recibe corrección.";
  }

  for (const field of ["backsight", "foresight"] as const) {
    const value = reading[field];
    if (value == null) continue;
    if (value < MIN_READING || value > MAX_READING) {
      errors[field] = `La lectura de mira debe estar entre ${MIN_READING.toFixed(3)} y ${MAX_READING.toFixed(3)} m.`;
    }
  }

  if (
    errors.backsight == null &&
    errors.foresight == null &&
    reading.backsight != null &&
    reading.foresight != null &&
    reading.backsight === reading.foresight
  ) {
    warnings.foresight = "Lectura atrás y adelante idénticas: posible error de anotación.";
  }

  return { errors, warnings };
}

/** ¿Tiene la lista de issues de captura algún error bloqueante? */
export function hasReadingErrors(issues: ReadingCaptureIssues[]): boolean {
  return issues.some((i) => Object.keys(i.errors).length > 0);
}

// --- Capa 2: validación de cierre (§ 5.2) -------------------------------------

export interface ClosureEvaluation {
  /** Se puede cerrar el proceso (como `closed` o como `rejected`). */
  canClose: boolean;
  /** El proceso solo puede cerrarse como `rejected` (no cumple tolerancia). */
  mustReject: boolean;
  /** El proceso no puede cerrarse de ninguna forma. */
  blocked: boolean;
  /** Mensajes para el banner de cierre. */
  messages: string[];
}

/**
 * Evalúa si un proceso de nivelación puede cerrarse, a partir de su
 * resultado de cálculo (§ 5.2).
 */
export function evaluateLevelingClosure(result: LevelingResult): ClosureEvaluation {
  // La comprobación aritmética (ΣL.Atrás − ΣL.Adelante == desnivel total) es
  // un fallo estructural en los datos, no un problema de precisión: si no
  // cuadra, ningún cierre es confiable y se bloquea sin más.
  if (!result.arithmeticCheckOk) {
    return {
      canClose: false,
      mustReject: false,
      blocked: true,
      messages: [
        "La comprobación aritmética no cuadra: ΣL.Atrás − ΣL.Adelante no coincide con el desnivel total.",
      ],
    };
  }

  const messages: string[] = [];
  let mustReject = false;

  if (result.meetsTolerance === false) {
    mustReject = true;
    messages.push(
      `El error de cierre (${result.closureErrorMm?.toFixed(1)} mm) supera la tolerancia (${result.toleranceMm?.toFixed(1)} mm); solo puede cerrarse como rechazado.`,
    );
  }

  if (result.meetsDiscrepancy === false) {
    messages.push(
      `La discrepancia entre ida y vuelta (${result.discrepancyMm?.toFixed(1)} mm) supera T·√2 (${result.discrepancyToleranceMm?.toFixed(1)} mm).`,
    );
  }

  return { canClose: true, mustReject, blocked: false, messages };
}
