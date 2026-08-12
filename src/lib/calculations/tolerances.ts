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
