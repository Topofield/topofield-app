// Validación del proceso de nivelación — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// Forma del resultado: sigue el patrón de `polygonal.ts` (Fase 3) — un
// `Record` por celda (`errors` / `warnings` indexados por campo) en vez del
// `ValidationIssue[]` propuesto en el brief de la tarea. El editor pinta cada
// celda de la libreta según su propio estado y así se consulta directo
// (`issues.errors.backsight`) sin recorrer un array filtrando por `field`.

import { resolveVisualDistances } from "@/lib/calculations/leveling";
import {
  MIDDLE_WIRE_TOLERANCE_M,
  SIGHT_BALANCE_LIMIT_M,
} from "@/lib/calculations/tolerances";
import type {
  LevelingResult,
  LevelingType,
  PointType,
  ReadingInput,
} from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

/** Issues de captura de una lectura, indexados por celda de la libreta. */
export interface ReadingCaptureIssues {
  errors: Partial<
    Record<
      | "pointCode"
      | "pointType"
      | "backsight"
      | "foresight"
      | "backWires"
      | "foreWires"
      | "backDistanceM"
      | "foreDistanceM",
      string
    >
  >;
  warnings: Partial<
    Record<"backsight" | "foresight" | "sightBalance", string>
  >;
}

/** Rango físico de una lectura de mira, en metros (§ 5.1). */
const MIN_READING = 0;
const MAX_READING = 4;

// El equilibrado de visuales (|d_V+ − d_V−| ≤ límite por orden) SÍ se
// valida desde la Fase 9: `backDistanceM` y `foreDistanceM` guardan una
// distancia por visual, que es lo que la comparación necesita. La deuda que la
// Fase 4 registró —una sola `distance_m` por fila no bastaba— queda pagada.
// Avisa, no bloquea: es un juicio sobre la calidad de una medición correcta en
// su forma. Ver `validateSightBalance`, más abajo.

/**
 * Tipos de punto que entran en la comprobación aritmética y en la
 * compensación (§ 5.1). Los `intermediate` cuelgan de la AI vigente y quedan
 * fuera de ambas, así que no exigen distancia por visual.
 */
function requiresVisualDistances(pointType: PointType): boolean {
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

  // --- Hilos: orden y coherencia del medio ---------------------------------
  for (const side of ["back", "fore"] as const) {
    const upper = side === "back" ? reading.backUpperM : reading.foreUpperM;
    const lower = side === "back" ? reading.backLowerM : reading.foreLowerM;
    const middle = side === "back" ? reading.backsight : reading.foresight;
    const wireKey = side === "back" ? "backWires" : "foreWires";

    // Con el par incompleto no hay orden que comprobar. No es un error: los
    // hilos son opcionales y la cartera de El Verjón trae dos armadas así.
    if (upper == null || lower == null) continue;

    if (upper <= lower) {
      errors[wireKey] =
        "El hilo superior debe ser mayor que el inferior: la distancia saldría nula o negativa.";
      continue;
    }

    if (middle != null) {
      const expected = (upper + lower) / 2;
      if (Math.abs(middle - expected) > MIDDLE_WIRE_TOLERANCE_M) {
        warnings[side === "back" ? "backsight" : "foresight"] =
          `El hilo medio debería ser ${expected.toFixed(4)} m, el promedio de los otros dos.`;
      }
    }
  }

  // --- Distancia por visual ------------------------------------------------
  // Obligatoria donde la fila acumula. Sin ella el acumulado queda corto, el
  // total sale menor del real y el punto de cierre queda mal compensado, con
  // el proceso reportando que cumple. Es la traducción al modelo nuevo de la
  // regla que hasta la Fase 9 exigía `distanceAccumulatedKm`: el acumulado ya
  // no se teclea, se deriva de estas distancias.
  if (requiresVisualDistances(reading.pointType)) {
    const { back, fore } = resolveVisualDistances(reading);
    if (reading.backsight != null && back == null) {
      errors.backDistanceM =
        "Falta la distancia de la V+: sin ella el recorrido no acumula.";
    }
    if (reading.foresight != null && fore == null) {
      errors.foreDistanceM =
        "Falta la distancia de la V−: sin ella el recorrido no acumula.";
    }
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
    warnings.foresight = "V+ y V− idénticas: posible error de anotación.";
  }

  return { errors, warnings };
}

/**
 * Equilibrado de visuales de una armada (§ 5.1; deuda de la Fase 4 pagada en
 * la Fase 9).
 *
 * Equilibrar las visuales cancela el error de colimación: si la visual sale
 * inclinada, el mismo error entra con signo opuesto en las dos lecturas y se
 * anula al restarlas. Avisa, no bloquea — es un juicio sobre la calidad de una
 * medición correcta en su forma.
 *
 * `distancesReconstructed` viene de `leveling_processes`: en los procesos que
 * el backfill de la Fase 9 reconstruyó, las dos distancias salen de repartir
 * por mitades la diferencia del acumulado, así que el equilibrado saldría
 * perfecto por construcción. Evaluarlo allí sería emitir una conformidad que
 * el dato no respalda.
 */
export function validateSightBalance(
  reading: ReadingInput,
  order: PrecisionOrder,
  distancesReconstructed: boolean,
): ReadingCaptureIssues {
  const errors: ReadingCaptureIssues["errors"] = {};
  const warnings: ReadingCaptureIssues["warnings"] = {};

  if (distancesReconstructed) return { errors, warnings };

  const { back, fore } = resolveVisualDistances(reading);
  if (back == null || fore == null) return { errors, warnings };

  const limit = SIGHT_BALANCE_LIMIT_M[order];
  const diff = Math.abs(back - fore);
  if (diff > limit) {
    warnings.sightBalance =
      `Visuales desequilibradas: ${diff.toFixed(1)} m de diferencia, el límite del orden es ${limit} m.`;
  }

  return { errors, warnings };
}

/** ¿Tiene la lista de issues de captura algún error bloqueante? */
export function hasReadingErrors(issues: ReadingCaptureIssues[]): boolean {
  return issues.some((i) => Object.keys(i.errors).length > 0);
}

/**
 * Valida una libreta completa (un recorrido), añadiendo a
 * `validateReadingCapture` el único error que depende de la POSICIÓN de la
 * fila dentro del recorrido: la V+ de la fila `bm` inicial.
 *
 * Por qué hace falta: `backsightDisabled` en `ReadingsTable` deshabilita la
 * celda de V+ en la última fila `bm` (la de cierre, que por definición no
 * la lleva), pero la habilita en cualquier otra — incluida la primera fila
 * en el instante en que el usuario la marca como `bm` antes de agregar el
 * resto de la libreta. En ese instante es a la vez primera y última, así que
 * queda deshabilitada; al agregar más filas se habilita pero arranca vacía,
 * y nada lo señalaba: `validateReadingCapture` no exige `backsight` en
 * ninguna fila porque no conoce su posición. El resultado es una AI en
 * blanco y todas las cotas desplazadas por igual, con el proceso guardable
 * igual. Medido en verificación de la Tarea 10.
 *
 * La fila `bm` FINAL (última del recorrido) es la única excepción legítima:
 * por definición no lleva V+, así que aquí no se exige.
 *
 * `levelingType` habilita una segunda regla posicional (hallazgo 1 de la
 * revisión final de la Fase 4): en un recorrido `closed` o `link` la ÚLTIMA
 * fila debe ser de tipo `bm` — es el punto de cierre contra el que se calcula
 * el error. `computeLeveling` usa la cota de la CADENA bm/pc para el cierre,
 * no la de la última fila, así que si esa última fila es una radiación
 * (`intermediate`) colgada después del BM de cierre, el motor sigue cerrando
 * correcto — pero una libreta así es, de todos modos, una captura mal
 * formada: la decisión #7 del PRD da por hecho que la última fila de un
 * recorrido que cierra es su BM. Se bloquea aquí para que nunca se guarde.
 * En `open` NO se exige: un recorrido sin control puede terminar donde sea.
 */
export function validateRunCapture(
  readings: ReadingInput[],
  levelingType: LevelingType,
  /**
   * Orden de precisión del proceso y si sus distancias las reconstruyó el
   * backfill. Gobiernan el equilibrado de visuales, que se evalúa aquí porque
   * esta es la puerta por la que pasan las filas de verdad.
   */
  order: PrecisionOrder = "tercer_orden",
  distancesReconstructed = false,
): ReadingCaptureIssues[] {
  const lastIndex = readings.length - 1;
  const mustEndInBm = levelingType !== "open";
  return readings.map((reading, index) => {
    const issues = validateReadingCapture(reading);
    const balance = validateSightBalance(
      reading,
      order,
      distancesReconstructed,
    );
    let errors = issues.errors;

    // Toda fila `bm` que no sea la última de cierre abre una armada y por
    // tanto necesita V+. La última `bm` es la única excepción legítima:
    // por definición cierra el recorrido y no lleva V+.
    const mustHaveBacksight = reading.pointType === "bm" && index !== lastIndex;
    if (mustHaveBacksight && reading.backsight == null) {
      errors = {
        ...errors,
        backsight:
          "Este BM necesita la V+: sin ella la AI de su armada queda vacía y todas las cotas siguientes se desplazan.",
      };
    }

    if (
      mustEndInBm &&
      index === lastIndex &&
      reading.pointType !== "bm"
    ) {
      errors = {
        ...errors,
        pointType:
          "La última fila de un recorrido que cierra debe ser el BM de cierre.",
      };
    }

    return {
      errors,
      warnings: { ...issues.warnings, ...balance.warnings },
    };
  });
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
  // La comprobación aritmética (ΣV+ − ΣV− == desnivel total) es
  // un fallo estructural en los datos, no un problema de precisión: si no
  // cuadra, ningún cierre es confiable y se bloquea sin más.
  if (!result.arithmeticCheckOk) {
    return {
      canClose: false,
      mustReject: false,
      blocked: true,
      messages: [
        "La comprobación aritmética no cuadra: ΣV+ − ΣV− no coincide con el desnivel total.",
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
