// Validación del proceso poligonal — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.

import { degreesToSeconds } from "@/lib/calculations/angles";
import { readingDispersionTolerance } from "@/lib/calculations/tolerances";
import type {
  PolygonalResult,
  PolygonalType,
  ReadingInput,
} from "@/types/polygonal";

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

export interface StationCaptureInput {
  /** Código del punto. Obligatorio siempre: `point_code` es `not null`. */
  pointCode: string;
  angleDeg: number | null;
  angleMin: number | null;
  angleSec: number | null;
  distance: number | null;
}

/** Issues de captura de una estación, indexados por celda. */
export interface CaptureIssues {
  errors: Partial<Record<"pointCode" | "angle" | "distance", string>>;
  warnings: Partial<Record<"pointCode" | "angle" | "distance", string>>;
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
  hasClosingRow = false,
): { angle: boolean; distance: boolean } {
  if (type === "closed") {
    // La fila de cierre es de control: lleva el ángulo contra el amarre y no
    // abre ningún lado, así que no pide distancia.
    if (hasClosingRow && index === total - 1) {
      return { angle: true, distance: false };
    }
    return { angle: true, distance: true };
  }
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

  // Código: obligatorio SIEMPRE, con independencia de `expect`. Una estación
  // sin ángulo ni distancia (la última de una abierta) sigue siendo un punto
  // del levantamiento y necesita identificarse; además `point_code` es
  // `not null` en la base. La regla es la misma que `validateReadingCapture`
  // aplica en nivelación desde la Fase 4.
  if (station.pointCode.trim() === "") {
    errors.pointCode = "El punto necesita un código.";
  }

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

/**
 * Valida las lecturas de un ángulo.
 *
 * La dispersión (máx − mín) es control de calidad de la captura: tres lecturas
 * que difieren 40" dicen algo que el promedio esconde. Se contrasta con la
 * precisión angular del equipo DEL PROCESO
 * (`polygonal_processes.angular_precision_seconds`, desde la Fase 8), no con
 * la tolerancia del orden: el orden gobierna el cierre de la poligonal,
 * mientras que repetir una lectura mide repetibilidad.
 *
 * `instrumentSeconds` no finito significa «el proceso no declaró equipo», y
 * entonces la dispersión NO se evalúa: sin vara no hay comparación. Misma
 * política que `totalStationMeetsOrder` en `tolerances.ts` — la función no
 * opina sobre lo que no sabe. Es deliberado que la ausencia llegue como
 * `NaN` y no como `0`: `Number(null)` es `0`, y un 0 aquí daba una tolerancia
 * de 0" contra la que cualquier par de lecturas distintas dispara el aviso
 * «…sobre los 0.0" que admite un equipo de 0"», que es falso y absurdo.
 *
 * Avisa, no bloquea — misma política que el resto del editor.
 */
export function validateReadings(
  readings: ReadingInput[],
  min: number,
  instrumentSeconds: number,
): { error?: string; warning?: string } {
  if (readings.length < min) {
    return { error: `Faltan lecturas: se exigen ${min} y hay ${readings.length}.` };
  }
  if (readings.length < 2) return {};
  if (!Number.isFinite(instrumentSeconds)) return {};

  const values = readings.map((r) => r.angle);
  const dispersion = degreesToSeconds(Math.max(...values) - Math.min(...values));
  const limit = readingDispersionTolerance(instrumentSeconds);
  if (dispersion > limit) {
    return {
      warning: `Dispersión de ${dispersion.toFixed(1)}" entre lecturas, sobre los ${limit.toFixed(1)}" que admite un equipo de ${instrumentSeconds}".`,
    };
  }
  return {};
}

/**
 * ¿Se puede guardar el formato de captura de ángulos en un proceso con este
 * estado? (Fase 13, P1.) En uno cerrado o rechazado no: es inmutable, y ahí el
 * conmutador solo cambia la vista.
 */
export function canPersistAngleFormat(status: string): boolean {
  return status !== "closed" && status !== "rejected";
}

/**
 * ¿Están completos y son válidos los pesos del ajuste por mínimos cuadrados?
 * (Fase 14.) Solo se exigen con ese método, que además no aplica a la abierta
 * sin control: no tiene redundancia que ajustar. Devuelve el motivo o null.
 */
export function validateLeastSquaresWeights(
  method: string,
  type: string,
  weights: {
    sigmaAngleSeconds: number | null;
    sigmaDistanceM: number | null;
    distanceMeasurements: number | null;
  },
): string | null {
  if (method !== "least_squares") return null;
  if (type === "open_uncontrolled") {
    return "La abierta sin control no tiene nada que ajustar: elija otro método.";
  }
  const { sigmaAngleSeconds: a, sigmaDistanceM: d, distanceMeasurements: m } = weights;
  if (a == null || d == null || m == null) {
    return "Faltan los pesos del ajuste: σ angular, σ de distancia y número de mediciones.";
  }
  if (!(a > 0) || !(d > 0)) return "Los σ del ajuste deben ser mayores que cero.";
  // Los límites de las columnas: decimal(6,2) y decimal(8,4). Un σ que la base
  // redondeara a cero lo rechazaría su CHECK con un error opaco.
  if (a < 0.01 || a > 9999.99) return "El σ angular debe estar entre 0.01″ y 9999.99″.";
  if (d < 0.0001 || d > 9999.9999) {
    return "El σ de distancia debe estar entre 0.0001 m y 9999.9999 m.";
  }
  if (!Number.isInteger(m) || m < 1) return "El número de mediciones debe ser un entero de 1 o más.";
  return null;
}
