// Los datos de la sección de una nivelación en el informe (Fase 36): lo
// guardado y su cálculo, con el orden detectado. Sale del mismo borrador que
// la pantalla por pasos, así que el informe es por construcción lo que
// muestran Libreta y Compensación. Puro.

import { levelingDraftOf, levelingInputOf } from "@/components/leveling/leveling-save";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import type { LevelingInput, LevelingProcess, LevelingReading, LevelingResult, RunType } from "@/types/leveling";
import type { PrecisionOrder } from "@/types/project";

export interface LevelingSectionData {
  process: LevelingProcess;
  readings: LevelingReading[];
  input: Omit<LevelingInput, "order" | "compensation">;
  result: LevelingResult;
  /** El orden alcanzado; `null` sin verificación o sin alcanzarlo. */
  order: PrecisionOrder | null;
  verifiable: boolean;
  /** El recorrido que la libreta aún no termina. */
  pending: RunType | null;
}

export function levelingSectionData(process: LevelingProcess, readings: LevelingReading[]): LevelingSectionData {
  const input = levelingInputOf(levelingDraftOf(process, readings));
  const { result, order, verifiable, pending } = computeLevelingDetected(input);
  return { process, readings, input, result, order, verifiable, pending };
}
