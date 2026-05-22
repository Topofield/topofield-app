// Tolerancias por orden de precisión — constantes y fórmulas (PRD § 5.4).
// Funciones puras. Las tolerancias viven aquí, nunca hardcodeadas en componentes.
//
// El módulo de nivelación (Fase 4) añadirá aquí su propia tabla de tolerancias.

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
