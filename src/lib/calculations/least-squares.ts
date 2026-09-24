// Ajuste por mínimos cuadrados con ecuaciones de condición (Fase 14).
// Funciones puras: sin React, sin Supabase. Solo álgebra.
//
// El modelo lo pone quien llama: observaciones, sus σ y una función que da
// las condiciones f(l) y sus coeficientes A = ∂f/∂l. Aquí solo se resuelve:
//
//   v = −Q·Aᵀ·(A·Q·Aᵀ)⁻¹·w,   Q = diag(σ²)
//
// iterando con w = f(lₖ) + A·(l₀ − lₖ), porque las condiciones de una
// poligonal no son lineales en los ángulos. Ver docs/prds/13-minimos-cuadrados.md.

export interface ConditionModel {
  /** Observaciones medidas l₀. */
  observations: number[];
  /** Desviación típica a priori de cada observación, en sus unidades. */
  sigmas: number[];
  /** Condiciones en `l` y sus coeficientes: `f.length` filas de `A`. */
  evaluate: (l: number[]) => { f: number[]; A: number[][] };
}

export interface ConditionAdjustment {
  /** Observaciones ajustadas l₀ + v. */
  adjusted: number[];
  /** Correcciones v. */
  corrections: number[];
  /** Condiciones evaluadas en las observaciones ajustadas: deben ser ~0. */
  residuals: number[];
  /** Desviación típica a posteriori de la unidad de peso: √(vᵀPv / r). */
  sigma0: number;
  iterations: number;
  converged: boolean;
}

/** Resuelve un sistema lineal pequeño por eliminación con pivote parcial. */
export function solveLinear(M: number[][], b: number[]): number[] {
  const n = b.length;
  const a = M.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    }
    [a[c], a[p]] = [a[p]!, a[c]!];
    const pivot = a[c]![c]!;
    if (Math.abs(pivot) < 1e-300) throw new Error("Sistema singular");
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = a[r]![c]! / pivot;
      for (let x = c; x <= n; x++) a[r]![x]! -= k * a[c]![x]!;
    }
  }
  return a.map((row, i) => row[n]! / row[i]!);
}

/**
 * Ajusta por ecuaciones de condición hasta que las correcciones cambien menos
 * que `tolerance` (en las unidades de cada observación relativa a su σ) o se
 * llegue a `maxIterations`.
 */
export function adjustByConditions(
  model: ConditionModel,
  // 1e-10 σ: por debajo, el cambio entre iteraciones es ruido de coma flotante
  // —una corrección angular en radianes ronda 1e-5—, y exigir 1e-12 solo
  // añadía iteraciones que no movían nada.
  { tolerance = 1e-10, maxIterations = 10 } = {},
): ConditionAdjustment {
  const l0 = model.observations;
  const q = model.sigmas.map((s) => s * s);
  let l = [...l0];
  let corrections = l0.map(() => 0);
  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    iterations += 1;
    const { f, A } = model.evaluate(l);
    const r = f.length;
    // w = f(lₖ) + A·(l₀ − lₖ): el cierre linealizado alrededor del último punto.
    const w = f.map((fk, k) => fk + A[k]!.reduce((acc, a, i) => acc + a * (l0[i]! - l[i]!), 0));
    const N = Array.from({ length: r }, (_, i) =>
      Array.from({ length: r }, (_, j) =>
        A[i]!.reduce((acc, a, x) => acc + a * q[x]! * A[j]![x]!, 0),
      ),
    );
    const k = solveLinear(N, w.map((x) => -x));
    const v = l0.map((_, x) => q[x]! * A.reduce((acc, row, i) => acc + row[x]! * k[i]!, 0));

    // Cambio relativo a cada σ, para comparar ángulos y distancias en la misma escala.
    const change = Math.max(
      ...v.map((vx, x) => Math.abs(vx - corrections[x]!) / (model.sigmas[x] || 1)),
    );
    corrections = v;
    l = l0.map((x, i) => x + v[i]!);
    if (change < tolerance) {
      converged = true;
      break;
    }
  }

  const { f } = model.evaluate(l);
  const vPv = corrections.reduce((acc, v, x) => acc + (v * v) / q[x]!, 0);
  return {
    adjusted: l,
    corrections,
    residuals: f,
    sigma0: f.length > 0 ? Math.sqrt(vPv / f.length) : 0,
    iterations,
    converged,
  };
}

/**
 * Banda en que σ₀ se lee como «≈ 1». Decisión con nombre y sin prueba
 * estadística detrás (la χ² queda fuera de la fase): con pocas condiciones,
 * σ₀ fluctúa mucho aunque los pesos sean los correctos, así que la banda es
 * ancha. Solo cambia el texto que acompaña a σ₀; no decide nada.
 */
export const SIGMA0_BAND: readonly [number, number] = [0.5, 2];

export type Sigma0Reading = "consistent" | "worse" | "pessimistic";

/** Lectura de σ₀ frente a los pesos supuestos. */
export function sigma0Reading(sigma0: number): Sigma0Reading {
  if (sigma0 > SIGMA0_BAND[1]) return "worse";
  if (sigma0 < SIGMA0_BAND[0]) return "pessimistic";
  return "consistent";
}
