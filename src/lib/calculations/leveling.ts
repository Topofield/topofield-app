// Algoritmos de nivelación geométrica (PRD § 6.7-6.9).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase. Solo math.

import { levelingTolerance } from "./tolerances";
import type {
  ComputedReading,
  LevelingInput,
  LevelingResult,
  ReadingInput,
  RunResult,
} from "@/types/leveling";

/**
 * Distancia por taquimetría sobre la mira: D = (HS − HI)·K.
 *
 * `K = 100` en instrumentos modernos. La visual de un nivel es horizontal por
 * construcción, así que NO lleva la corrección por cos²α que sí necesitaría un
 * teodolito inclinado.
 *
 * No valida el orden de los hilos: `HS ≤ HI` da un resultado nulo o negativo.
 * Rechazarlo es responsabilidad del validador (`validators/leveling.ts`), que
 * bloquea porque una distancia negativa envenena el acumulado, el total y con
 * ellos la tolerancia K·√D.
 */
export function stadiaDistance(upper: number, lower: number, k = 100): number {
  return (upper - lower) * k;
}

/**
 * Distancia derivada de un par de hilos, o `null` si el par está incompleto.
 *
 * Los hilos son opcionales y pueden venir a medias (la cartera de El Verjón
 * tiene dos armadas sin hilo inferior). Un par incompleto no deriva nada y
 * tampoco es un error: la distancia se teclea.
 */
export function distanceFromWires(
  upper: number | null,
  lower: number | null,
): number | null {
  if (upper == null || lower == null) return null;
  return stadiaDistance(upper, lower);
}

/**
 * Distancia efectiva de cada visual de una fila.
 *
 * Los hilos tienen prioridad sobre la distancia tecleada: cuando el par está
 * completo, los hilos SON la medición y la distancia es su resultado
 * autocompletado. Con el par incompleto o ausente, vale lo tecleado.
 */
export function resolveVisualDistances(reading: ReadingInput): {
  back: number | null;
  fore: number | null;
} {
  return {
    back:
      distanceFromWires(reading.backUpperM, reading.backLowerM) ??
      reading.backDistanceM,
    fore:
      distanceFromWires(reading.foreUpperM, reading.foreLowerM) ??
      reading.foreDistanceM,
  };
}

/**
 * Distancia acumulada por fila, en METROS, desde las distancias por visual.
 *
 * Una armada aporta la distancia a la mira de atrás más la de adelante. Los
 * puntos `intermediate` aportan 0 y HEREDAN el acumulado de la armada de la
 * que cuelgan — que es lo que `applyProportionalCorrection` necesita para
 * interpolarles la corrección—, y la cadena continúa detrás de ellos.
 *
 * Que la cadena continúe no es un detalle: en la cartera de El Verjón una
 * vista intermedia rompió la suma de la hoja de cálculo y dejó 24.7 m fuera
 * del total, con el veredicto de cierre emitido sobre el número equivocado.
 */
export function accumulateDistances(readings: ReadingInput[]): number[] {
  let running = 0;
  return readings.map((reading) => {
    if (reading.pointType === "intermediate") return running;
    const { back, fore } = resolveVisualDistances(reading);
    running += (fore ?? 0) + (back ?? 0);
    return running;
  });
}

/**
 * Distancia total del recorrido, en KILÓMETROS.
 *
 * Es el acumulado de la última fila. Por construcción coincide con el
 * acumulado de la fila terminal, que es lo que hace que el punto de cierre
 * cierre exactamente contra su cota conocida: la invariante que la Fase 9
 * establece y que el JSDoc de `applyProportionalCorrection` solo podía
 * documentar como contrato no verificado.
 */
export function totalDistanceFromReadings(readings: ReadingInput[]): number {
  const acc = accumulateDistances(readings);
  return (acc[acc.length - 1] ?? 0) / 1000;
}

/** Tolerancia de la comprobación aritmética, en metros (0.1 mm). */
const ARITHMETIC_EPSILON = 0.0001;

export interface RunComputation {
  readings: ComputedReading[];
  /** Desnivel de la sección: cota final − cota inicial. */
  heightDifference: number;
  /**
   * Cota final de la CADENA del recorrido (la que propagan `bm`/`pc`), no la
   * de la última fila. Un `intermediate` al final de la libreta no la altera:
   * su cota es una radiación colgada de la AI vigente, no el punto de cierre.
   * Úsala para cualquier cálculo de error de cierre; `readings.at(-1)` es la
   * última FILA capturada, que puede ser una radiación.
   */
  finalElevation: number;
  sumBacksights: number;
  sumForesights: number;
  arithmeticCheckOk: boolean;
}

/**
 * Recorre la libreta calculando altura de instrumento y cotas (§ 6.7).
 *
 * La regla, por fila y en este orden:
 *   1. si tiene L.Ad → cota = AI_vigente − L.Ad   (consume la AI anterior)
 *   2. si tiene L.At → AI_vigente = cota + L.At   (genera la armada siguiente)
 *
 * El orden importa: en la fila de un punto de cambio, la L.Ad viene de la
 * armada anterior y la L.At abre la siguiente. Invertirlo desplaza todas las
 * cotas del recorrido.
 *
 * Los puntos `intermediate` consumen la AI vigente pero no la actualizan ni
 * propagan cota, y quedan fuera de la comprobación aritmética.
 */
export function computeRun(
  readings: ReadingInput[],
  startElevation: number,
): RunComputation {
  let instrumentHeight: number | null = null;
  let currentElevation = startElevation;

  let sumBacksights = 0;
  let sumForesights = 0;

  // El acumulado se DERIVA de las distancias por visual; ya no viene tecleado.
  // Eso hace que el acumulado de la fila terminal y el total del recorrido
  // sean el mismo número por construcción.
  const accumulated = accumulateDistances(readings);

  const computed: ComputedReading[] = readings.map((reading, index) => {
    const isIntermediate = reading.pointType === "intermediate";
    let rowElevation = currentElevation;
    let rowInstrumentHeight: number | null = null;

    // 1. Consumir la AI vigente.
    if (reading.foresight != null && instrumentHeight != null) {
      rowElevation = instrumentHeight - reading.foresight;
      if (!isIntermediate) {
        sumForesights += reading.foresight;
        currentElevation = rowElevation;
      }
    }

    // 2. Generar la AI de la armada siguiente. Un intermedio nunca lo hace.
    if (!isIntermediate && reading.backsight != null) {
      rowInstrumentHeight = rowElevation + reading.backsight;
      instrumentHeight = rowInstrumentHeight;
      sumBacksights += reading.backsight;
    }

    return {
      ...reading,
      distanceAccumulatedKm: accumulated[index] / 1000,
      instrumentHeight: rowInstrumentHeight,
      elevationCalculated: rowElevation,
      elevationCorrected: rowElevation,
      correctionApplied: 0,
    };
  });

  const heightDifference = currentElevation - startElevation;

  // ΣL.At − ΣL.Ad = cota_final − cota_inicial. Solo valida la aritmética de
  // gabinete: cuadra igual con el nivel descolimado. La calidad la juzga el
  // error de cierre contra la tolerancia.
  const arithmeticCheckOk =
    Math.abs(sumBacksights - sumForesights - heightDifference) <
    ARITHMETIC_EPSILON;

  return {
    readings: computed,
    heightDifference,
    finalElevation: currentElevation,
    sumBacksights,
    sumForesights,
    arithmeticCheckOk,
  };
}

/**
 * Corrección proporcional a la distancia acumulada (§ 6.8):
 *
 *   Corr_i = −Error × (d_acum_i / D_total)
 *
 * La corrección de la fila terminal (la que tiene d_acum = D_total) iguala
 * −Error, de modo que el punto final cierra exactamente contra su cota
 * conocida. No es la *suma* de las correcciones: cada una es acumulativa desde
 * el origen, no un incremento, así que la suma de todas es mayor que −Error.
 * Los puntos `intermediate` heredan la
 * corrección de la armada de la que cuelgan: se interpola por su propia
 * distancia acumulada, que es la de esa armada.
 *
 * INVARIANTE (desde la Fase 9): `distanceAccumulatedKm` ya no se teclea — lo
 * deriva `accumulateDistances` de las distancias por visual—, así que el
 * acumulado de la fila terminal es igual a `totalDistanceKm` por construcción.
 * El punto final cierra por tanto exactamente contra su cota conocida.
 *
 * Antes de la Fase 9 esto era un contrato NO verificado: una fila terminal con
 * el acumulado mal puesto dejaba el cierre descompensado en silencio, con el
 * proceso reportando conformidad. Medido en la Fase 4: 99.992 en vez de
 * 100.000, con los −8 mm intactos.
 */
export function applyProportionalCorrection(
  readings: ComputedReading[],
  errorMm: number,
  totalDistanceKm: number,
): ComputedReading[] {
  if (totalDistanceKm <= 0) {
    return readings.map((reading) => ({
      ...reading,
      elevationCorrected: reading.elevationCalculated,
      correctionApplied: 0,
    }));
  }

  const errorM = errorMm / 1000;

  return readings.map((reading) => {
    const accumulated = reading.distanceAccumulatedKm ?? 0;
    const correction = -errorM * (accumulated / totalDistanceKm);
    return {
      ...reading,
      correctionApplied: correction,
      elevationCorrected: reading.elevationCalculated + correction,
    };
  });
}

/** Cota conocida contra la que cierra el recorrido, o null si no cierra. */
function knownClosingElevation(input: LevelingInput): number | null {
  if (input.type === "closed") return input.startElevation;
  if (input.type === "link") return input.endElevation;
  return null; // `open` no cierra contra nada.
}

/**
 * Calcula un proceso de nivelación completo (§ 6.7-6.9).
 *
 * `open` se calcula pero no se cierra ni se corrige: sin un segundo punto de
 * cota conocida no hay forma de detectar el error acumulado.
 *
 * Esta función NO valida que las filas traigan `distanceAccumulatedKm`
 * completo (ver el contrato documentado en `applyProportionalCorrection`).
 * Si faltan distancias acumuladas, `meetsTolerance` puede seguir en `true`
 * mientras las cotas corregidas quedan mal calculadas. Rechazar o exigir esos
 * datos en captura es responsabilidad de la capa de validadores
 * (`src/lib/validators/leveling.ts`, Tarea 7), no del motor de cálculo.
 *
 * `totalDistanceKm` no finito o ≤ 0 (p. ej. `Number.NaN`, el valor con el
 * que nace un proceso recién creado, antes de que el editor lo complete) dejan
 * `toleranceMm`/`meetsTolerance` y `discrepancyToleranceMm`/`meetsDiscrepancy`
 * en `null`: sin distancia no hay con qué evaluar K·√D. `closureErrorMm` (y
 * el error de cierre de la vuelta) NO dependen de la distancia y se calculan
 * igual.
 */
export function computeLeveling(input: LevelingInput): LevelingResult {
  const forward = computeRun(input.forward, input.startElevation);
  const known = knownClosingElevation(input);

  // La distancia ya no se teclea: se deriva de las distancias por visual de la
  // propia libreta. Eso hace que el acumulado terminal y el total sean el
  // mismo número por construcción, y con ello que el punto de cierre cierre
  // exacto contra su cota conocida.
  const totalDistanceKm = totalDistanceFromReadings(input.forward);

  // Una libreta sin distancias capturadas da 0. Sin distancia no hay con qué
  // evaluar K·√D, así que la tolerancia queda en `null` en vez de propagar
  // `NaN` (que además volvería `meetsTolerance` `false` sin significar nada,
  // porque toda comparación con `NaN` es `false`). El error de cierre SÍ es
  // independiente de la distancia y se sigue calculando igual.
  const hasValidDistance =
    Number.isFinite(totalDistanceKm) && totalDistanceKm > 0;

  let closureErrorMm: number | null = null;
  let toleranceMm: number | null = null;
  let meetsTolerance: boolean | null = null;
  let readings = forward.readings;

  if (known != null) {
    closureErrorMm = (forward.finalElevation - known) * 1000;

    if (hasValidDistance) {
      toleranceMm = levelingTolerance(input.order, totalDistanceKm);
      meetsTolerance = Math.abs(closureErrorMm) <= toleranceMm;

      // Solo se compensa un trabajo que cumple la tolerancia. Si no cumple,
      // se repite el levantamiento (marco teórico § 8.1).
      if (meetsTolerance) {
        readings = applyProportionalCorrection(
          forward.readings,
          closureErrorMm,
          totalDistanceKm,
        );
      }
    }
  }

  const forwardResult: RunResult = {
    readings,
    heightDifference: forward.heightDifference,
    errorMm: closureErrorMm,
  };

  // --- Ida y vuelta (§ 6.9, enmendado — decisión #2) -----------------------
  // Los recorridos son mediciones independientes: distintos puntos de cambio
  // y, con frecuencia, distinto número de armadas. El emparejamiento es a
  // nivel de SECCIÓN (entre los BM extremos), nunca tramo a tramo.
  let returnResult: RunResult | null = null;
  let discrepancyMm: number | null = null;
  let discrepancyToleranceMm: number | null = null;
  let meetsDiscrepancy: boolean | null = null;
  let adoptedHeightDifference: number | null = null;

  if (input.return != null && input.return.length > 0) {
    // La vuelta parte de la cota conocida del extremo al que llegó la ida.
    const returnStart = known ?? input.startElevation;
    const back = computeRun(input.return, returnStart);

    discrepancyMm =
      Math.abs(forward.heightDifference + back.heightDifference) * 1000;
    // La vuelta tiene su propia distancia: es otra medición, con otras armadas
    // y a menudo otra longitud. En la cartera de El Verjón la ida mide 384.3 m
    // y la vuelta 397.6 m. Se evalúa con la MENOR de las dos, que es el
    // criterio conservador — la hoja de El Verjón juzga el cierre con la
    // distancia del recorrido contrario, que es arbitrario.
    const returnDistanceKm = totalDistanceFromReadings(input.return);
    const pairDistanceKm = Math.min(
      totalDistanceKm || Number.POSITIVE_INFINITY,
      returnDistanceKm || Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(pairDistanceKm) && pairDistanceKm > 0) {
      discrepancyToleranceMm =
        levelingTolerance(input.order, pairDistanceKm) * Math.SQRT2;
      meetsDiscrepancy = discrepancyMm <= discrepancyToleranceMm;
    }
    adoptedHeightDifference =
      (forward.heightDifference - back.heightDifference) / 2;

    // Error de cierre de la vuelta: compara su cota final contra la cota
    // conocida del origen de la ida (en `closed` y en `link` la vuelta
    // siempre regresa a input.startElevation). Distinto de la discrepancia,
    // que compara ida contra vuelta entre sí. Sin cota conocida (`known ==
    // null`, tipo `open`) no hay contra qué cerrar.
    const returnErrorMm =
      known != null
        ? (back.finalElevation - input.startElevation) * 1000
        : null;

    returnResult = {
      readings: back.readings,
      heightDifference: back.heightDifference,
      errorMm: returnErrorMm,
    };
  }

  return {
    forward: forwardResult,
    return: returnResult,
    arithmeticCheckOk: forward.arithmeticCheckOk,
    sumBacksights: forward.sumBacksights,
    sumForesights: forward.sumForesights,
    closureErrorMm,
    toleranceMm,
    meetsTolerance,
    discrepancyMm,
    discrepancyToleranceMm,
    meetsDiscrepancy,
    adoptedHeightDifference,
  };
}
