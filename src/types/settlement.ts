// Tipos de dominio del control de asentamientos: literales de los CHECK del
// schema, filas tipadas y los contratos de entrada y resultado de
// src/lib/calculations/settlement.ts.

import type { Tables } from "./database";
import type { ComputedReading as LevelingComputedReading, PointType } from "./leveling";
import type { LevelType, PrecisionOrder } from "./project";

export const VISIT_STATUSES = ["draft", "in_progress", "calculated"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** Niveles del semáforo (§ 6.11). El orden es significativo: peor gana. */
export const ALERT_LEVELS = ["normal", "caution", "alert", "alarm"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

// --- Filas tipadas ---

export type SettlementPoint = Tables<"settlement_points">;

/**
 * Una visita. Desde la Fase 37 toda visita se mide con libreta, y su orden es
 * el del tramo peor: null si alguno no se verifica.
 */
export type SettlementVisit = Omit<Tables<"settlement_visits">, "status" | "level_type" | "precision_order"> & {
  status: VisitStatus;
  level_type: LevelType | null;
  precision_order: PrecisionOrder | null;
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
}

/** Un punto del catálogo, con lo que el cálculo necesita de él. */
export interface PointInput {
  id: string;
  code: string;
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
   * no.
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
  /** Margen de ruido de las dos visitas, en mm (`trendDeviationMargin`). */
  marginMm: number;
}

/** Tendencia de la velocidad entre las dos últimas visitas de un punto. */
export type Trend = "converging" | "accelerating";

export interface SettlementHistory {
  visits: VisitResult[];
}

/**
 * Lo que la derivación de cotas encuentra en una libreta (Fase 18). Los
 * `error` bloquean el guardado; los `warning` se muestran y no bloquean.
 */
export type BookIssue =
  | { kind: "duplicate"; level: "error"; pointId: string; code: string; rows: number[] }
  | { kind: "inactive"; level: "warning"; pointId: string; code: string; row: number }
  | { kind: "missing"; level: "warning"; pointId: string; code: string };

/**
 * Una fila de la libreta de la visita tal como viaja entre el editor y el
 * servidor: números ya parseados, sin calculados. Misma forma que el
 * `ReadingDraft` de nivelación, del que es la libreta hermana.
 */
export interface BookRowPayload {
  pointCode: string;
  pointType: PointType;
  backsight: number | null;
  foresight: number | null;
  backUpperM: number | null;
  backLowerM: number | null;
  foreUpperM: number | null;
  foreLowerM: number | null;
  backDistanceM: number | null;
  foreDistanceM: number | null;
  /**
   * La fila abre un tramo: su V+ sale de un BM del lugar con cota conocida
   * (Fase 37, decisión 8). La primera fila siempre lo abre; sin el campo,
   * `false`.
   */
  startsSection?: boolean;
}

/** Un BM del lugar, tal como lo usa el motor: código y cota (Fase 37). */
export interface BenchmarkInput {
  code: string;
  elevation: number;
  /**
   * La visita que lo midió: un punto auxiliar guardado en los BM del lugar
   * (revisión final de la Fase 37). No verifica esa visita.
   */
  originVisitId?: string | null;
}

/** Cómo termina un tramo: en su BM, en otro BM del lugar o en sus puntos. */
export type TramoKind = "closed" | "link" | "open";

/** Un tramo de la libreta de una visita, calculado sin compensar (Fase 37). */
export interface TramoResult {
  /** Índices de su primera y su última fila en la libreta. */
  start: number;
  end: number;
  startCode: string;
  /** El BM del lugar donde termina; null si es abierto. */
  endCode: string | null;
  kind: TramoKind;
  /** null si arranca en un código que no es BM del lugar. */
  startElevation: number | null;
  /** Cierre (o llegada) en mm, a 0.1; null si es abierto. */
  closureMm: number | null;
  /** El orden que alcanza; null si es abierto, sin distancias o fuera de todos. */
  order: PrecisionOrder | null;
  /** K·√L del orden alcanzado, a 0.1; null sin orden. */
  toleranceMm: number | null;
  /** Longitud del tramo; null sin distancias. */
  distanceKm: number | null;
  /** Toda su cadena tiene lecturas: sin esto no hay cierre ni orden. */
  complete: boolean;
}

/** La libreta de una visita, tramo a tramo y sin compensar (Fase 37). */
export interface VisitBook {
  tramos: TramoResult[];
  /**
   * Una por fila de la libreta, en su orden, calculadas sin compensar. Una
   * fila sin su lectura, o detrás de una V+ o una V− que falta en la cadena
   * de su tramo, tiene la cota en NaN: el motor de nivelación tomaría la
   * lectura vacía por cero.
   */
  readings: LevelingComputedReading[];
}

/** La verificación de una visita: la de su tramo peor (Fase 37, decisión 15). */
export interface VisitVerification {
  /** Todos los tramos terminan en un BM del lugar y alcanzan un orden. */
  verified: boolean;
  /** El orden más bajo de los tramos; null si alguno no se verifica. */
  order: PrecisionOrder | null;
  /** El tramo peor: el primero sin verificar o el de orden más bajo. */
  worst: TramoResult | null;
  /** Suma de las longitudes; null si ningún tramo tiene distancias. */
  distanceKm: number | null;
}

/**
 * La comprobación de un BM de control en la libreta de una visita (Fase 30):
 * otro BM del catálogo por el que pasa el circuito, comparado con su cota de
 * catálogo. Si no nivela, uno de los dos BM pudo moverse.
 */
export interface BenchmarkCheck {
  rowIndex: number;
  code: string;
  catalogElevation: number;
  /** La cota CALCULADA de la libreta, sin compensar, a 4 decimales. */
  measuredElevation: number;
  /** Calculada − catálogo, en mm a 0.1. */
  differenceMm: number;
  /** K·√L con L la distancia acumulada hasta la fila. Null sin distancias. */
  toleranceMm: number | null;
  meetsTolerance: boolean | null;
}

/** Una cota derivada de la libreta: la de la fila `rowIndex`. */
export interface DerivedElevation {
  pointId: string;
  elevation: number;
  rowIndex: number;
}

// --- Etiquetas en español ---

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  draft: "Borrador",
  in_progress: "En medición",
  calculated: "Calculada",
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  normal: "Normal",
  caution: "Precaución",
  alert: "Alerta",
  alarm: "Alarma",
};
