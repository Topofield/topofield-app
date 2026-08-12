// Algoritmos de nivelación geométrica (PRD § 6.7-6.9).
// Funciones puras de TypeScript: sin React, sin hooks, sin Supabase. Solo math.

import type { ComputedReading, ReadingInput } from "@/types/leveling";

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
