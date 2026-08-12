// Tipos de dominio del proceso de nivelación: literales de los CHECK del
// schema, etiquetas en español, filas tipadas y los contratos de entrada y
// resultado de src/lib/calculations/leveling.ts.

import type { Tables } from "./database";
import type { PrecisionOrder } from "./project";

// El ciclo de estados es común a todos los procesos; vive en polygonal.ts
// desde la Fase 3 y se reutiliza tal cual.
export type { ProcessStatus } from "./polygonal";
export { PROCESS_STATUSES, PROCESS_STATUS_LABELS } from "./polygonal";

// --- Literales de los CHECK del schema (PRD § 3.2 + decisión #7) ---

export const LEVELING_TYPES = ["closed", "link", "open"] as const;
export type LevelingType = (typeof LEVELING_TYPES)[number];

export const RUN_TYPES = ["forward", "return"] as const;
export type RunType = (typeof RUN_TYPES)[number];

/**
 * Tipo de punto en la libreta:
 * - `bm`: banco de nivel, cota conocida. Ancla el recorrido.
 * - `pc`: punto de cambio. Recibe L.Ad de una armada y L.At de la siguiente;
 *   propaga la cota entre armadas.
 * - `intermediate`: radiación. Solo recibe L.Ad, cuelga de la AI vigente, no
 *   propaga cota y queda FUERA de la comprobación aritmética y de la
 *   compensación.
 */
export const POINT_TYPES = ["bm", "pc", "intermediate"] as const;
export type PointType = (typeof POINT_TYPES)[number];

export const CORRECTION_METHODS = ["proportional_distance"] as const;
export type LevelingCorrectionMethod = (typeof CORRECTION_METHODS)[number];

// --- Filas tipadas ---

export type LevelingProcess = Omit<
  Tables<"leveling_processes">,
  "type" | "correction_method" | "status"
> & {
  type: LevelingType;
  correction_method: LevelingCorrectionMethod;
  status: import("./polygonal").ProcessStatus;
};

export type LevelingReading = Omit<
  Tables<"leveling_readings">,
  "run_type" | "point_type"
> & {
  run_type: RunType;
  point_type: PointType;
};

// --- Contratos de cálculo ---

export interface ReadingInput {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  distanceM: number | null;
  distanceAccumulatedKm: number | null;
}

export interface LevelingInput {
  type: LevelingType;
  /** Cota conocida del BM de partida. */
  startElevation: number;
  /** Cota conocida del BM de llegada. Solo `link`; null en el resto. */
  endElevation: number | null;
  order: PrecisionOrder;
  /** Distancia del recorrido en UN solo sentido, en km (decisión #9). */
  totalDistanceKm: number;
  forward: ReadingInput[];
  /** Recorrido de vuelta, independiente de la ida (decisión #2). */
  return: ReadingInput[] | null;
}

export interface ComputedReading extends ReadingInput {
  /** AI de la armada que abre esta fila. Null si la fila no lleva L.At. */
  instrumentHeight: number | null;
  elevationCalculated: number;
  elevationCorrected: number;
  /** Corrección aplicada, en metros. */
  correctionApplied: number;
}

export interface RunResult {
  readings: ComputedReading[];
  /** Desnivel de la sección: cota final − cota inicial. */
  heightDifference: number;
  /** Error de cierre del recorrido en mm. Null si el tipo no cierra. */
  errorMm: number | null;
}

export interface LevelingResult {
  forward: RunResult;
  return: RunResult | null;
  // Comprobación aritmética (solo bm y pc; los intermedios se excluyen).
  arithmeticCheckOk: boolean;
  sumBacksights: number;
  sumForesights: number;
  // Cierre. Null en `open`, que no cierra contra nada.
  closureErrorMm: number | null;
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
  // Ida y vuelta. Null si has_return_run es false.
  discrepancyMm: number | null;
  discrepancyToleranceMm: number | null;
  meetsDiscrepancy: boolean | null;
  adoptedHeightDifference: number | null;
}

// --- Etiquetas en español ---

export const LEVELING_TYPE_LABELS: Record<LevelingType, string> = {
  closed: "Cerrada",
  link: "De enlace",
  open: "Abierta sin control",
};

export const POINT_TYPE_LABELS: Record<PointType, string> = {
  bm: "BM",
  pc: "Punto de cambio",
  intermediate: "Intermedio",
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  forward: "Ida",
  return: "Vuelta",
};
