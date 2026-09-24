// Tipos de dominio del control de asentamientos: literales de los CHECK del
// schema, filas tipadas y los contratos de entrada y resultado de
// src/lib/calculations/settlement.ts.

import type { Tables } from "./database";
import type { PointType } from "./leveling";
import type { LevelType, PrecisionOrder } from "./project";

export const VISIT_STATUSES = ["draft", "calculated", "closed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/**
 * Cómo se capturan las cotas de una visita (Fase 18):
 * - `book`: con su libreta de nivelación; las cotas de los puntos de control
 *   se DERIVAN de ella en el servidor.
 * - `direct`: tecleadas punto por punto. Las visitas anteriores a la Fase 18,
 *   o una nivelación procesada fuera de la app.
 */
export const CAPTURE_MODES = ["book", "direct"] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];

/** Niveles del semáforo (§ 6.11). El orden es significativo: peor gana. */
export const ALERT_LEVELS = ["normal", "caution", "alert", "alarm"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

// --- Filas tipadas ---

export type SettlementPoint = Tables<"settlement_points">;

export type SettlementVisit = Omit<
  Tables<"settlement_visits">,
  "status" | "level_type" | "precision_order" | "capture_mode"
> & {
  status: VisitStatus;
  level_type: LevelType | null;
  precision_order: PrecisionOrder;
  capture_mode: CaptureMode;
};

/** Una fila de la libreta de nivelación de una visita (Fase 18). */
export type SettlementBookReading = Omit<
  Tables<"settlement_book_readings">,
  "point_type"
> & {
  point_type: PointType;
};

export type SettlementReading = Omit<
  Tables<"settlement_readings">,
  "alert_status"
> & {
  alert_status: AlertLevel;
};

// --- Contratos de cálculo ---

/** Umbrales de un lugar, ya desnormalizados para el motor de cálculo. */
export interface Thresholds {
  velocityCaution: number;
  velocityAlert: number;
  velocityAlarm: number;
  accumulatedCaution: number;
  accumulatedAlert: number;
  accumulatedAlarm: number;
  /** El X de 1/X. */
  angularDistortionLimit: number;
}

/** Un punto del catálogo, con lo que el cálculo necesita de él. */
export interface PointInput {
  id: string;
  code: string;
  northing: number | null;
  easting: number | null;
  /**
   * Cota C0 tecleada en el catálogo. Si es null, la línea base del punto es su
   * primera lectura (Fase 11): la «visita 0» de un BM dado de alta a mitad del
   * monitoreo es la primera en que se midió.
   */
  initialElevation: number | null;
  /** Fecha de alta (ISO). Null = punto original del lugar. */
  activeFrom: string | null;
  /**
   * Fecha de baja (ISO): la PRIMERA fecha en que ya no se mide. Null = vigente.
   * Ver `isPointActiveOn`.
   */
  retiredOn: string | null;
}

/**
 * Una lectura de campo: la cota medida de un punto en una visita.
 *
 * OJO: `src/types/leveling.ts` exporta otro `ReadingInput` con forma distinta
 * (vistas V+/V− sobre la mira). Los dos nombres coexisten porque cada uno
 * es el natural en su módulo, pero un archivo que necesite ambos debe
 * renombrar en el import:
 * `import type { ReadingInput as LevelingReadingInput } from "@/types/leveling"`.
 */
export interface ReadingInput {
  pointId: string;
  elevation: number;
}

/** Una visita con sus lecturas, tal como entra al motor. */
export interface VisitInput {
  id: string;
  visitNumber: number;
  /** Fecha de la visita en formato ISO `YYYY-MM-DD`. */
  date: string;
  readings: ReadingInput[];
}

/** Resultado por punto dentro de una visita. */
export interface ComputedReading {
  pointId: string;
  elevation: number;
  /** mm vs la visita anterior. Null en la línea base. */
  partialSettlement: number | null;
  /**
   * mm vs la línea base del punto: su C0 o, sin C0, su primera lectura. Nunca
   * es null en una lectura calculada por el motor; el tipo lo admite porque
   * los consumidores también leen filas persistidas.
   */
  accumulatedSettlement: number | null;
  /** mm/mes. Null en la línea base o si Δt = 0. */
  velocity: number | null;
  alertStatus: AlertLevel;
  /**
   * Fecha de la línea base del punto: la de la primera visita del lugar si
   * tiene C0 (la C0 es la cota de la visita 0), o la de su primera lectura si
   * no. Los diferenciales la necesitan para comparar periodos comunes.
   */
  baselineDate: string;
  /** Cota de la línea base: la C0 o la primera lectura. */
  baselineElevation: number;
}

export interface VisitResult {
  visitId: string;
  visitNumber: number;
  date: string;
  readings: ComputedReading[];
  /** El peor nivel de alerta de la visita. */
  worstAlert: AlertLevel;
}

/** Un par de puntos con su asentamiento diferencial y su distorsión. */
export interface DifferentialPair {
  pointIdA: string;
  pointIdB: string;
  /** mm, siempre positivo. */
  differentialMm: number;
  /**
   * Asentamiento de cada punto (mm) desde `sinceDate`: los dos números cuya
   * diferencia es `differentialMm`. Para dos puntos originales es su
   * acumulado; para un par con un punto de alta, el asentamiento sobre el
   * periodo común (Fase 11). Mostrar el acumulado en su lugar pondría en
   * pantalla dos números que restados no dan el diferencial.
   */
  settlementAMm: number;
  settlementBMm: number;
  /** Fecha desde la que se miden los dos asentamientos (ISO). */
  sinceDate: string;
  /** Distancia horizontal en m. */
  distanceM: number;
  /**
   * El X de 1/X. `Infinity` cuando el diferencial es 0: dos puntos que se
   * asientan igual no tienen distorsión entre sí.
   */
  distortionInverse: number;
  exceedsLimit: boolean;
}

/**
 * Aviso de lectura fuera de tendencia (Fase 12): la lectura va contra la
 * dirección de su punto, o lo mueve más del doble de lo que su ritmo anterior
 * predice. Es calidad del dato, no gravedad del movimiento: avisa, no
 * bloquea, y no cambia el semáforo.
 */
export interface TrendDeviation {
  pointId: string;
  kind: "contrary" | "excessive";
  /** Parcial de la lectura, en mm (signo: negativo = descenso). */
  partialMm: number;
  /** Velocidad de la lectura anterior del punto, en mm/mes. */
  previousVelocity: number;
  /** Movimiento que el ritmo anterior preveía para este intervalo, en mm (positivo). */
  expectedMm: number;
  /** Margen del orden de la visita, en mm. */
  marginMm: number;
}

/** Tendencia de la velocidad entre las dos últimas visitas de un punto. */
export type Trend = "converging" | "accelerating";

export interface SettlementHistory {
  visits: VisitResult[];
  differentials: DifferentialPair[];
  /**
   * Tendencia por punto. Un punto solo aparece si tiene al menos 2 velocidades
   * (es decir, 3 visitas): con menos no se afirma nada.
   */
  trends: Record<string, Trend>;
}

/**
 * Lo que la derivación de cotas encuentra en una libreta (Fase 18). Los
 * `error` bloquean el guardado; los `warning` se muestran y no bloquean.
 */
export type BookIssue =
  | { kind: "duplicate"; level: "error"; pointId: string; code: string; rows: number[] }
  | { kind: "inactive"; level: "warning"; pointId: string; code: string; row: number }
  | { kind: "missing"; level: "warning"; pointId: string; code: string };

/** Una cota derivada de la libreta: la de la fila `rowIndex`. */
export interface DerivedElevation {
  pointId: string;
  elevation: number;
  rowIndex: number;
}

// --- Etiquetas en español ---

export const CAPTURE_MODE_LABELS: Record<CaptureMode, string> = {
  book: "Libreta de nivelación",
  direct: "Cotas directas",
};

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  draft: "Borrador",
  calculated: "Calculada",
  closed: "Cerrada",
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  normal: "Normal",
  caution: "Precaución",
  alert: "Alerta",
  alarm: "Alarma",
};
