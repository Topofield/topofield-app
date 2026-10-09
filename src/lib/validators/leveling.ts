// Validación del proceso de nivelación — funciones puras (PRD § 5.1 capa de
// captura, § 5.2 capa de cierre). Sin React, sin Supabase.
//
// Forma del resultado: sigue el patrón de `polygonal.ts` (Fase 3) — un
// `Record` por celda (`errors` / `warnings` indexados por campo) en vez del
// `ValidationIssue[]` propuesto en el brief de la tarea. El editor pinta cada
// celda de la libreta según su propio estado y así se consulta directo
// (`issues.errors.backsight`) sin recorrer un array filtrando por `field`.

import { resolveVisualDistances } from "@/lib/calculations/leveling";
import { MIDDLE_WIRE_TOLERANCE_M } from "@/lib/calculations/tolerances";
import type {
  LevelingResult,
  LevelingType,
  PointType,
  ReadingInput,
  RunResult,
} from "@/types/leveling";

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
    Record<"backsight" | "foresight", string>
  >;
}

/**
 * Rango habitual de una lectura de mira, en metros (§ 5.1). Fuera de él la
 * lectura AVISA, no bloquea (Fase 42): una mira de 5 m lee 4.120 —la cartera
 * real de asentamientos lo hace— y una mira invertida, negativo.
 */
const MIN_READING = 0;
const MAX_READING = 4;

/** El aviso de una lectura fuera del rango habitual, o `null`. */
export function readingRangeWarning(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= MIN_READING && value <= MAX_READING) return null;
  return `La lectura de ${value.toFixed(3)} m está fuera de ${MIN_READING.toFixed(3)} a ${MAX_READING.toFixed(3)} m: compruebe que sea correcta.`;
}

/**
 * Tipos de punto que entran en la comprobación aritmética y en el acumulado
 * de distancias (§ 5.1). Los `intermediate` cuelgan de la AI vigente: quedan
 * fuera de los dos y no exigen distancia por visual. Se compensan con la
 * corrección de su armada.
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
    // Cero o negativa no es una medición: resta del acumulado y rebaja la
    // tolerancia K·√D sin aviso (Fase 26, C-11). La base lo impide también.
    if (back != null && back <= 0) {
      errors.backDistanceM = "La distancia debe ser mayor que cero.";
    }
    if (fore != null && fore <= 0) {
      errors.foreDistanceM = "La distancia debe ser mayor que cero.";
    }
  }

  for (const field of ["backsight", "foresight"] as const) {
    const warning = readingRangeWarning(reading[field]);
    if (warning) warnings[field] = warning;
  }

  if (
    warnings.foresight == null &&
    reading.backsight != null &&
    reading.foresight != null &&
    reading.backsight === reading.foresight
  ) {
    warnings.foresight = "V+ y V− idénticas: posible error de anotación.";
  }

  return { errors, warnings };
}

/** ¿Tiene la lista de issues de captura algún error bloqueante? */
export function hasReadingErrors(issues: ReadingCaptureIssues[]): boolean {
  return issues.some((i) => Object.keys(i.errors).length > 0);
}

/** Un punto de cambio al que le falta una de sus dos lecturas (Fase 24). */
export interface IncompleteTurningPoint {
  /** Fila del recorrido, desde 1. */
  row: number;
  missing: "V+" | "V−";
}

/**
 * El primer punto de cambio con V+ y sin V−, o con V− y sin V+ (Fase 24).
 *
 * Un punto de cambio cierra una armada con su V− y abre la siguiente con su
 * V+: sin una de las dos la cadena de alturas de instrumento se rompe y las
 * cotas siguientes salen de una AI equivocada. Una fila sin ninguna de las dos
 * es captura a medias y no cuenta. La primera y la última fila quedan fuera:
 * un recorrido abierto puede empezar o terminar en un punto de cambio, que
 * entonces solo abre o solo cierra.
 */
export function findIncompleteTurningPoint(
  readings: readonly ReadingInput[],
): IncompleteTurningPoint | null {
  for (let i = 1; i < readings.length - 1; i++) {
    const reading = readings[i]!;
    if (reading.pointType !== "pc") continue;
    const hasBack = reading.backsight != null;
    const hasFore = reading.foresight != null;
    if (hasBack && !hasFore) return { row: i + 1, missing: "V−" };
    if (hasFore && !hasBack) return { row: i + 1, missing: "V+" };
  }
  return null;
}

/**
 * Por qué no se puede cerrar una libreta con un punto de cambio incompleto,
 * nombrando la fila y el recorrido, o `null` (Fase 24). Revisa también la
 * vuelta, que no pasa por la comprobación aritmética del motor
 * (`arithmeticCheckOk` es la de la ida).
 */
export function turningPointBlocker(
  result: Pick<LevelingResult, "forward" | "return">,
): string | null {
  const runs: [string | null, RunResult][] = result.return
    ? [
        ["ida", result.forward],
        ["vuelta", result.return],
      ]
    : [[null, result.forward]];
  for (const [label, run] of runs) {
    const found = findIncompleteTurningPoint(run.readings);
    if (found) {
      const where = label ? ` de la ${label}` : "";
      return `El punto de cambio de la fila ${found.row}${where} no tiene ${found.missing}: sin ella la libreta no encadena y no se puede cerrar.`;
    }
  }
  return null;
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
 *
 * `allowUnfinished` (Fase 36): la nivelación se captura por armada y guarda
 * tras cada una, así que su libreta puede ir a medias; se guarda en curso y
 * sin compensar (`pendingRun`). La visita conserva la regla.
 */
export function validateRunCapture(
  readings: ReadingInput[],
  levelingType: LevelingType,
  { allowUnfinished = false }: { allowUnfinished?: boolean } = {},
): ReadingCaptureIssues[] {
  const lastIndex = readings.length - 1;
  const mustEndInBm = levelingType !== "open" && !allowUnfinished;
  return readings.map((reading, index) => {
    const issues = validateReadingCapture(reading);
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

    // Punto de cambio incompleto (Fase 24): aviso, no error. Capturar a
    // medias es legítimo; el cierre lo bloquea con el mismo criterio
    // (`findIncompleteTurningPoint`), que exime la primera y la última fila.
    let warnings = issues.warnings;
    if (
      reading.pointType === "pc" &&
      index !== 0 &&
      index !== lastIndex &&
      (reading.backsight == null) !== (reading.foresight == null)
    ) {
      const side = reading.foresight == null ? "foresight" : "backsight";
      if (warnings[side] == null) {
        warnings = {
          ...warnings,
          [side]:
            side === "foresight"
              ? "Falta la V−: el punto de cambio no cierra su armada."
              : "Falta la V+: el punto de cambio no abre la armada siguiente.",
        };
      }
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

    return { errors, warnings };
  });
}
