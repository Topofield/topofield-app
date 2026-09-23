// Tipos de dominio del control de asentamientos: literales de los CHECK del
// schema, filas tipadas y los contratos de entrada y resultado de
// src/lib/calculations/settlement.ts.

import type { Tables } from "./database";
import type { LevelType, PrecisionOrder } from "./project";

export const VISIT_STATUSES = ["draft", "calculated", "closed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Niveles del semáforo (§ 6.11). El orden es significativo: peor gana. */
export const ALERT_LEVELS = ["normal", "caution", "alert", "alarm"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

// --- Filas tipadas ---

export type SettlementPoint = Tables<"settlement_points">;

export type SettlementVisit = Omit<
  Tables<"settlement_visits">,
  "status" | "level_type" | "precision_order"
> & {
  status: VisitStatus;
  level_type: LevelType | null;
  precision_order: PrecisionOrder;
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
  /** Distancia horizontal en m. */
  distanceM: number;
  /**
   * El X de 1/X. `Infinity` cuando el diferencial es 0: dos puntos que se
   * asientan igual no tienen distorsión entre sí.
   */
  distortionInverse: number;
  exceedsLimit: boolean;
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

// --- Etiquetas en español ---

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
