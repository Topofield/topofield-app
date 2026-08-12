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

/** Tolerancia de la comprobación aritmética, en metros (0.1 mm). */
const ARITHMETIC_EPSILON = 0.0001;

export interface RunComputation {
  readings: ComputedReading[];
  /** Desnivel de la sección: cota final − cota inicial. */
  heightDifference: number;
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

  const computed: ComputedReading[] = readings.map((reading) => {
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
 * CONTRATO: el cierre exacto del punto final depende de que su fila traiga
 * `distanceAccumulatedKm` no nulo e igual a `totalDistanceKm`. Una fila con
 * `distanceAccumulatedKm: null` se trata como si estuviera en el origen
 * (`?? 0`) y por tanto recibe corrección 0, NO el reparto que le
 * correspondería. Si la fila del punto final llega con distancia nula, el
 * cierre exacto no se produce y el resultado queda sin corregir en silencio
 * — esta función no valida datos de entrada, solo reparte con la distancia
 * que recibe. Detectar filas con distancia faltante es responsabilidad de la
 * capa de validadores (`src/lib/validators/leveling.ts`, Tarea 7).
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
 */
export function computeLeveling(input: LevelingInput): LevelingResult {
  const forward = computeRun(input.forward, input.startElevation);
  const known = knownClosingElevation(input);

  let closureErrorMm: number | null = null;
  let toleranceMm: number | null = null;
  let meetsTolerance: boolean | null = null;
  let readings = forward.readings;

  if (known != null) {
    const lastElevation =
      forward.readings.at(-1)?.elevationCalculated ?? input.startElevation;
    closureErrorMm = (lastElevation - known) * 1000;
    toleranceMm = levelingTolerance(input.order, input.totalDistanceKm);
    meetsTolerance = Math.abs(closureErrorMm) <= toleranceMm;

    // Solo se compensa un trabajo que cumple la tolerancia. Si no cumple, se
    // repite el levantamiento (marco teórico § 8.1).
    if (meetsTolerance) {
      readings = applyProportionalCorrection(
        forward.readings,
        closureErrorMm,
        input.totalDistanceKm,
      );
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
    discrepancyToleranceMm =
      levelingTolerance(input.order, input.totalDistanceKm) * Math.SQRT2;
    meetsDiscrepancy = discrepancyMm <= discrepancyToleranceMm;
    adoptedHeightDifference =
      (forward.heightDifference - back.heightDifference) / 2;

    returnResult = {
      readings: back.readings,
      heightDifference: back.heightDifference,
      errorMm: null,
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
