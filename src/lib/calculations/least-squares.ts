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

export class SingularSystemError extends Error {
  constructor() {
    super("Sistema singular");
  }
}

/**
 * Resuelve un sistema lineal pequeño por eliminación con pivote parcial.
 * Lanza `SingularSystemError` si un pivote es despreciable frente a la mayor
 * entrada de la matriz: con coma flotante, un sistema de rango incompleto rara
 * vez da un pivote exactamente cero, y sin tolerancia relativa devolvería
 * números enormes sin avisar.
 */
export function solveLinear(M: number[][], b: number[]): number[] {
  const n = b.length;
  const a = M.map((row, i) => [...row, b[i]!]);
  const scale = Math.max(...M.flat().map(Math.abs), 0);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    }
    [a[c], a[p]] = [a[p]!, a[c]!];
    const pivot = a[c]![c]!;
    if (!(Math.abs(pivot) > 1e-12 * scale)) throw new SingularSystemError();
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = a[r]![c]! / pivot;
      for (let x = c; x <= n; x++) a[r]![x]! -= k * a[c]![x]!;
    }
  }
  return a.map((row, i) => row[n]! / row[i]!);
}

/**
 * Resuelve N·k = b escalando antes filas y columnas por 1/√Nᵢᵢ (Fase 26, C-9).
 * Las condiciones mezclan unidades —la angular en radianes², las de cierre en
 * metros²— y sin escalar, una σ angular pequeña con una σ de distancia grande
 * dejaba el pivote angular por debajo del umbral relativo de `solveLinear`:
 * «sistema singular» con un sistema que no lo es. Escalado, la diagonal es 1 y
 * el umbral mide lo que debe: dependencia entre condiciones.
 */
function solveScaled(N: number[][], b: number[]): number[] {
  const d = N.map((row, i) => row[i]!);
  if (!d.every((x) => x > 0)) throw new SingularSystemError();
  const s = d.map((x) => 1 / Math.sqrt(x));
  const scaled = N.map((row, i) => row.map((x, j) => x * s[i]! * s[j]!));
  const y = solveLinear(scaled, b.map((x, i) => x * s[i]!));
  return y.map((x, i) => x * s[i]!);
}

/**
 * Ajusta por ecuaciones de condición hasta que las correcciones cambien menos
 * que `tolerance` (en las unidades de cada observación relativa a su σ) o se
 * llegue a `maxIterations`.
 */
export function adjustByConditions(
  model: ConditionModel,
  // 1e-8 σ: el cambio entre iteraciones se estanca en el ruido de coma
  // flotante, que puede quedar por encima de 1e-10 σ —con 1e-10, alguna
  // abierta con control terminaba en «no converge» con las condiciones ya
  // cumplidas a 1e-13 m (Fase 26, C-7)—. 1e-8 σ de un ángulo de 5″ son
  // 2·10⁻¹³ rad: nada que se vea en una coordenada.
  { tolerance = 1e-8, maxIterations = 10 } = {},
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
    const k = solveScaled(N, w.map((x) => -x));
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

/** Redundancia r de una poligonal: 3 condiciones, o 2 sin azimut de llegada. */
export type Redundancy = 2 | 3;

/**
 * Valores críticos de la prueba χ² bilateral al 95 % para cada redundancia r:
 * el inferior y el superior (Fase 32, D-6).
 *
 * Con pesos correctos, r·σ₀² sigue una χ² con r grados de libertad (Ghilani y
 * Wolf, *Adjustment Computations*, § 5.4 y § 16.7). USACE EM 1110-2-1009
 * (2018) la pide al 95 % (§ 9-5.h y § 9-2.g). Sustituye a la banda [0.5, 2]
 * sobre σ₀, que no tenía fuente y con r = 2 o 3 juzgaba mal entre el 15 y el
 * 24 % de los ajustes correctos. Solo están r = 2 y r = 3 porque son los
 * únicos que da una poligonal. Sigue sin decidir nada: solo cambia el texto
 * que acompaña a σ₀.
 */
export const SIGMA0_CHI2_95: Record<Redundancy, readonly [number, number]> = {
  2: [0.0506356, 7.3777589],
  3: [0.2157953, 9.3484036],
};

/** Intervalo de σ₀ que acepta la prueba: [√(χ²inf/r), √(χ²sup/r)]. */
export function sigma0Interval(r: Redundancy): [number, number] {
  const [lo, hi] = SIGMA0_CHI2_95[r];
  return [Math.sqrt(lo / r), Math.sqrt(hi / r)];
}

export type Sigma0Reading = "consistent" | "worse" | "pessimistic";

/** Lectura de σ₀ frente a los pesos supuestos, con la prueba χ² de su r. */
export function sigma0Reading(sigma0: number, r: Redundancy): Sigma0Reading {
  const [lo, hi] = sigma0Interval(r);
  if (sigma0 > hi) return "worse";
  if (sigma0 < lo) return "pessimistic";
  return "consistent";
}
