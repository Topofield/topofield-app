// Tolerancias por orden de precisión — constantes y fórmulas (PRD § 5.4).
// Funciones puras. Las tolerancias viven aquí, nunca hardcodeadas en componentes.
//
// Tolerancias de poligonal (Fase 3) y nivelación (Fase 4).

import type { PrecisionOrder } from "@/types/project";

/** Coeficiente K de la tolerancia angular K·√n, en segundos de arco. */
export const ANGULAR_TOLERANCE_K: Record<PrecisionOrder, number> = {
  primer_orden: 1,
  segundo_orden: 5,
  tercer_orden: 15,
  ordinario: 30,
};

/** Precisión relativa mínima exigida, expresada como el X de 1:X. */
export const MIN_RELATIVE_PRECISION: Record<PrecisionOrder, number> = {
  primer_orden: 100000,
  segundo_orden: 20000,
  tercer_orden: 5000,
  ordinario: 3000,
};

/**
 * Tolerancia angular en segundos de arco: K·√n, donde n es el número de
 * ángulos medidos (= número de estaciones de la poligonal).
 */
export function angularTolerance(order: PrecisionOrder, n: number): number {
  return ANGULAR_TOLERANCE_K[order] * Math.sqrt(n);
}

/** Precisión relativa mínima exigida para el orden dado (el X de 1:X). */
export function minRelativePrecision(order: PrecisionOrder): number {
  return MIN_RELATIVE_PRECISION[order];
}

/**
 * Coeficiente K de la tolerancia de nivelación K·√D, en milímetros
 * (PRD § 5.4). Coinciden con la tabla del marco teórico § 8; su «Segundo
 * Orden Clase II» es nuestro `segundo_orden`. Los niveles «Clase I» (K=4) y
 * «Expedita» (K=50) del marco teórico no están modelados en
 * `projects.precision_order` (decisión #4 del PRD de fase).
 */
export const LEVELING_TOLERANCE_K: Record<PrecisionOrder, number> = {
  primer_orden: 3,
  segundo_orden: 6,
  tercer_orden: 12,
  ordinario: 24,
};

/**
 * Tolerancia de cierre de nivelación en milímetros: K·√D_km.
 *
 * IMPORTANTE: `distanceKm` es la longitud del recorrido en UN SOLO SENTIDO,
 * nunca ida+vuelta (decisión #9 del PRD de fase). Las fuentes discrepan en
 * este punto — FGCS distingue D (sección, un sentido) de F (perímetro de
 * circuito) — y usar el recorrido total inflaría la tolerancia en √2 (≈41 %).
 */
export function levelingTolerance(
  order: PrecisionOrder,
  distanceKm: number,
): number {
  return LEVELING_TOLERANCE_K[order] * Math.sqrt(distanceKm);
}

// ============================================================================
// Tolerancias de asentamientos (Fase 5).
// ============================================================================

import type { StructureType } from "@/types/site";
import type { Thresholds } from "@/types/settlement";

/**
 * Días de un mes, para convertir un intervalo entre visitas a meses.
 *
 * 365.25/12 — el promedio del año gregoriano. Se fija como constante porque el
 * marco teórico nunca define el mes y por eso calcula mal la velocidad: sus
 * tablas copian el asentamiento parcial en la columna de velocidad siempre que
 * el intervalo sea «un mes», ignorando que los meses tienen 28, 30 o 31 días
 * (verificado: 3 de los 7 intervalos del histórico de P-09 no coinciden con
 * ningún cálculo válido). Ver docs/prds/04-asentamientos.md, hallazgo 2 y
 * decisión #3.
 */
export const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Umbrales de alerta por tipo de estructura (marco teórico § 4.1).
 *
 * El § 3.2 del PRD principal daba un único default (10/25/50) que son los
 * umbrales de PRESA, de modo que un edificio se clasificaba con criterio de
 * presa: habría marcado alarma a los 50 mm cuando su propio marco de referencia
 * sitúa ahí el umbral de alerta. El preset se aplica al elegir el tipo de
 * estructura y siempre queda editable (decisión #2).
 */
export const SETTLEMENT_THRESHOLD_PRESETS: Record<StructureType, Thresholds> = {
  edificio: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
  presa: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 10,
    accumulatedAlert: 25,
    accumulatedAlarm: 50,
    angularDistortionLimit: 500,
  },
  terraplen: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
  otro: {
    velocityCaution: 2,
    velocityAlert: 5,
    velocityAlarm: 10,
    accumulatedCaution: 25,
    accumulatedAlert: 50,
    accumulatedAlarm: 75,
    angularDistortionLimit: 500,
  },
};

/** Preset de umbrales del tipo de estructura dado. */
export function thresholdsFor(structureType: StructureType): Thresholds {
  return SETTLEMENT_THRESHOLD_PRESETS[structureType];
}
