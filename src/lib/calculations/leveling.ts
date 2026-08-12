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
 * La suma de correcciones iguala −Error, de modo que el punto final cierra
 * exactamente contra su cota conocida. Los puntos `intermediate` heredan la
 * corrección de la armada de la que cuelgan: se interpola por su propia
 * distancia acumulada, que es la de esa armada.
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

  return {
    forward: forwardResult,
    return: null,
    arithmeticCheckOk: forward.arithmeticCheckOk,
    sumBacksights: forward.sumBacksights,
    sumForesights: forward.sumForesights,
    closureErrorMm,
    toleranceMm,
    meetsTolerance,
    discrepancyMm: null,
    discrepancyToleranceMm: null,
    meetsDiscrepancy: null,
    adoptedHeightDifference: null,
  };
}
