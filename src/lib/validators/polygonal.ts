// Validación del proceso poligonal — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.

import type { PolygonalResult, PolygonalType } from "@/types/polygonal";

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

export interface StationCaptureInput {
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  distance: number | null;
}

/** Issues de captura de una estación, indexados por celda (`angle` / `distance`). */
export interface CaptureIssues {
  errors: Partial<Record<"angle" | "distance", string>>;
  warnings: Partial<Record<"angle" | "distance", string>>;
}

/**
 * Qué celdas son obligatorias para una estación según su tipo de poligonal y
 * su posición dentro del recorrido.
 *
 * Vive aquí (no en el editor) para que el cliente y la revalidación del
 * servidor apliquen exactamente la misma regla: una estación inicial sin
 * ángulo, o una final sin ángulo ni distancia, es captura parcial legítima
 * (§ 5.1), no un error — y ambos lados deben coincidir en cuál es cuál.
 */
export function expectStationCapture(
  type: PolygonalType,
  index: number,
  total: number,
): { angle: boolean; distance: boolean } {
  if (type === "closed") return { angle: true, distance: true };
  if (index === 0) return { angle: false, distance: true };
  if (index === total - 1) return { angle: false, distance: false };
  return { angle: true, distance: true };
}

/**
 * Valida la captura de una estación. `expect` indica qué celdas son obligatorias
 * para esta estación (varía según tipo de poligonal y posición).
 */
export function validatePolygonalStation(
  station: StationCaptureInput,
  expect: { angle: boolean; distance: boolean },
): CaptureIssues {
  const errors: CaptureIssues["errors"] = {};
  const warnings: CaptureIssues["warnings"] = {};

  // Distancia: ≤ 0 o > 1000 m bloquea; vacía obligatoria bloquea.
  const { distance } = station;
  if (distance == null) {
    if (expect.distance) errors.distance = "La distancia es obligatoria.";
  } else if (distance <= 0) {
    errors.distance = "La distancia debe ser mayor que cero.";
  } else if (distance > 1000) {
    errors.distance = "La distancia no puede superar los 1000 m.";
  }

  // Ángulo: minutos/segundos fuera de [0,60) bloquean; 0° o 360° advierten.
  const { angleDeg, angleMin, angleSec } = station;
  const angleComplete =
    angleDeg != null && angleMin != null && angleSec != null;

  if (!angleComplete) {
    if (expect.angle) errors.angle = "El ángulo es obligatorio.";
  } else if (angleMin < 0 || angleMin >= 60) {
    errors.angle = "Los minutos deben estar entre 0 y 59.";
  } else if (angleSec < 0 || angleSec >= 60) {
    errors.angle = "Los segundos deben estar entre 0 y 59.";
  } else if (
    angleMin === 0 &&
    angleSec === 0 &&
    (angleDeg === 0 || angleDeg === 360)
  ) {
    warnings.angle = "Ángulo de 0° o 360°: posible error de captura.";
  }

  return { errors, warnings };
}

/** ¿Tiene la lista de issues algún error bloqueante? */
export function hasCaptureErrors(issues: CaptureIssues[]): boolean {
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
 * Evalúa si un proceso poligonal puede cerrarse, a partir de su resultado de
 * cálculo y de si hay errores de captura pendientes.
 */
export function evaluatePolygonalClosure(
  type: PolygonalType,
  result: PolygonalResult,
  captureHasErrors: boolean,
): ClosureEvaluation {
  if (captureHasErrors) {
    return {
      canClose: false,
      mustReject: false,
      blocked: true,
      messages: ["Hay celdas con errores de captura; corrígelas antes de cerrar."],
    };
  }

  if (type === "open_uncontrolled") {
    const computed = result.stations.length > 0 &&
      result.stations.every((s) => s.north != null);
    return computed
      ? { canClose: true, mustReject: false, blocked: false, messages: [] }
      : {
          canClose: false,
          mustReject: false,
          blocked: true,
          messages: ["Completa los datos de todas las estaciones."],
        };
  }

  if (type === "closed") {
    if (result.anglesMeetTolerance == null || result.meetsLinearTolerance == null) {
      return {
        canClose: false,
        mustReject: false,
        blocked: true,
        messages: ["Completa los datos de la poligonal antes de cerrar."],
      };
    }
    if (!result.anglesMeetTolerance) {
      return {
        canClose: false,
        mustReject: false,
        blocked: true,
        messages: [
          "El error angular supera la tolerancia del orden de precisión; no se puede cerrar.",
        ],
      };
    }
    if (!result.meetsLinearTolerance) {
      return {
        canClose: true,
        mustReject: true,
        blocked: false,
        messages: [
          "La precisión relativa no alcanza la tolerancia; solo puede cerrarse como rechazado.",
        ],
      };
    }
    return { canClose: true, mustReject: false, blocked: false, messages: [] };
  }

  // open_controlled
  if (result.meetsLinearTolerance == null) {
    return {
      canClose: false,
      mustReject: false,
      blocked: true,
      messages: ["Completa los datos y el punto de llegada antes de cerrar."],
    };
  }
  if (!result.meetsLinearTolerance) {
    return {
      canClose: true,
      mustReject: true,
      blocked: false,
      messages: [
        "El cierre contra el punto conocido no alcanza la tolerancia; solo puede cerrarse como rechazado.",
      ],
    };
  }
  return { canClose: true, mustReject: false, blocked: false, messages: [] };
}
