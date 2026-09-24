// Tipos de dominio del proceso de nivelación: literales de los CHECK del
// schema, etiquetas en español, filas tipadas y los contratos de entrada y
// resultado de src/lib/calculations/leveling.ts.

import type { Tables } from "./database";
import type { LevelType, PrecisionOrder } from "./project";

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
 * - `pc`: punto de cambio. Recibe la V− de una armada y la V+ de la siguiente;
 *   propaga la cota entre armadas.
 * - `intermediate`: radiación. Solo recibe V−, cuelga de la AI vigente, no
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
  "type" | "correction_method" | "status" | "level_type" | "precision_order"
> & {
  type: LevelingType;
  correction_method: LevelingCorrectionMethod;
  status: import("./polygonal").ProcessStatus;
  level_type: LevelType | null;
  precision_order: PrecisionOrder;
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
  /**
   * Hilos estadimétricos de la V+. OPCIONALES: con nivel automático
   * el topógrafo puede anotar solo la lectura y medir la distancia a cinta.
   * Verificado contra la cartera de El Verjón, donde dos armadas de doce no
   * traen el hilo inferior.
   *
   * El hilo MEDIO no tiene campo propio: es `backsight`. Darle uno crearía dos
   * fuentes de verdad para el mismo número.
   */
  backUpperM: number | null;
  backLowerM: number | null;
  /** Ídem para la V−; el hilo medio es `foresight`. */
  foreUpperM: number | null;
  foreLowerM: number | null;
  /**
   * Distancia a cada mira, en metros. Derivada de los hilos cuando los hay, o
   * tecleada. Es la ÚNICA entrada de la cadena de distancias: el acumulado y
   * el total se derivan de ella.
   */
  backDistanceM: number | null;
  foreDistanceM: number | null;
  /**
   * DERIVADO. Lo calcula `accumulateDistances`; la UI lo muestra en solo
   * lectura y el servidor lo persiste. Se conserva en el contrato porque el
   * informe y el export lo leen sin recalcular.
   */
  distanceAccumulatedKm: number | null;
}

export interface LevelingInput {
  type: LevelingType;
  /** Cota conocida del BM de partida. */
  startElevation: number;
  /** Cota conocida del BM de llegada. Solo `link`; null en el resto. */
  endElevation: number | null;
  order: PrecisionOrder;
  /**
   * La distancia total NO viaja en el input desde la Fase 9: se deriva de las
   * distancias por visual de `forward` con `totalDistanceFromReadings`. Ver
   * `computeLeveling`.
   */
  forward: ReadingInput[];
  /** Recorrido de vuelta, independiente de la ida (decisión #2). */
  return: ReadingInput[] | null;
}

export interface ComputedReading extends ReadingInput {
  /**
   * Distancias por visual RESUELTAS: derivadas de los hilos cuando los hay, o
   * las tecleadas. Es lo que hay que persistir — la distancia tecleada sola
   * dejaría vacía la celda de un proceso capturado por taquimetría, y el
   * informe y el export leen la fila sin recalcular.
   */
  backDistanceResolvedM: number | null;
  foreDistanceResolvedM: number | null;
  /** AI de la armada que abre esta fila. Null si la fila no lleva V+. */
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

/**
 * Un punto que la ida y la vuelta comparten (Fase 17). Informativo: el
 * veredicto sigue siendo la discrepancia de la sección.
 */
export interface HomologousPoint {
  /** El código tal como aparece en la vuelta. */
  pointCode: string;
  pointType: PointType;
  forwardElevation: number;
  returnElevation: number;
  /** Cota de la vuelta − cota de la ida, en mm. Cotas calculadas, sin compensar. */
  residualMm: number;
}

export interface HomologousComparison {
  /** En el orden de la vuelta. */
  points: HomologousPoint[];
  /** Códigos compartidos que no se emparejan por repetirse dentro de un recorrido. */
  skippedCodes: string[];
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
