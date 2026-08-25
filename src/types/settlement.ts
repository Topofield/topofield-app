// Tipos de dominio del control de asentamientos: literales de los CHECK del
// schema, filas tipadas y los contratos de entrada y resultado de
// src/lib/calculations/settlement.ts.

import type { Tables } from "./database";

export const VISIT_STATUSES = ["draft", "calculated", "closed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Niveles del semáforo (§ 6.11). El orden es significativo: peor gana. */
export const ALERT_LEVELS = ["normal", "caution", "alert", "alarm"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

// --- Filas tipadas ---

export type SettlementPoint = Tables<"settlement_points">;

export type SettlementVisit = Omit<Tables<"settlement_visits">, "status"> & {
  status: VisitStatus;
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
  /** Cota C0, la línea base contra la que se mide el acumulado. */
  initialElevation: number | null;
}

/**
 * Una lectura de campo: la cota medida de un punto en una visita.
 *
 * OJO: `src/types/leveling.ts` exporta otro `ReadingInput` con forma distinta
 * (lecturas de mira atrás/adelante). Los dos nombres coexisten porque cada uno
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
  /** mm vs C0. Null si el punto no tiene C0. */
  accumulatedSettlement: number | null;
  /** mm/mes. Null en la línea base o si Δt = 0. */
  velocity: number | null;
  alertStatus: AlertLevel;
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
