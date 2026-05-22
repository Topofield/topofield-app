// Tipos de dominio del proceso poligonal: literales de los CHECK del schema,
// etiquetas en español, filas tipadas y los contratos de entrada/resultado de
// los algoritmos de cálculo (src/lib/calculations/polygonal.ts).

import type { Tables } from "./database";
import type { PrecisionOrder } from "./project";

// --- Literales de los CHECK del schema (PRD § 3.2) ---

export const POLYGONAL_TYPES = [
  "closed",
  "open_controlled",
  "open_uncontrolled",
] as const;
export type PolygonalType = (typeof POLYGONAL_TYPES)[number];

export const ANGLE_TYPES = ["internal", "deflection", "azimuth"] as const;
export type AngleType = (typeof ANGLE_TYPES)[number];

export const CORRECTION_METHODS = ["bowditch", "transit", "crandall"] as const;
export type CorrectionMethod = (typeof CORRECTION_METHODS)[number];

export const DEFLECTION_DIRECTIONS = ["right", "left"] as const;
export type DeflectionDirection = (typeof DEFLECTION_DIRECTIONS)[number];

export const PROCESS_STATUSES = [
  "draft",
  "in_progress",
  "calculated",
  "closed",
  "rejected",
] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

// --- Filas tipadas: estrechan los campos string de la DB a sus literales ---

export type PolygonalProcess = Omit<
  Tables<"polygonal_processes">,
  "type" | "angle_type" | "correction_method" | "status"
> & {
  type: PolygonalType;
  angle_type: AngleType;
  correction_method: CorrectionMethod | null;
  status: ProcessStatus;
};

export type PolygonalStation = Omit<
  Tables<"polygonal_stations">,
  "deflection_direction"
> & {
  deflection_direction: DeflectionDirection | null;
};

// --- Etiquetas en español ---

export const POLYGONAL_TYPE_LABELS: Record<PolygonalType, string> = {
  closed: "Cerrada",
  open_controlled: "Abierta con control",
  open_uncontrolled: "Abierta sin control",
};

export const CORRECTION_METHOD_LABELS: Record<CorrectionMethod, string> = {
  bowditch: "Bowditch (brújula)",
  transit: "Tránsito",
  crandall: "Crandall",
};

export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  draft: "Borrador",
  in_progress: "En progreso",
  calculated: "Calculado",
  closed: "Cerrado",
  rejected: "Rechazado",
};

export const DEFLECTION_DIRECTION_LABELS: Record<DeflectionDirection, string> =
  {
    right: "Derecha",
    left: "Izquierda",
  };

// --- Opciones para <Select> ---

export const POLYGONAL_TYPE_OPTIONS = POLYGONAL_TYPES.map((value) => ({
  value,
  label: POLYGONAL_TYPE_LABELS[value],
}));

export const CORRECTION_METHOD_OPTIONS = CORRECTION_METHODS.map((value) => ({
  value,
  label: CORRECTION_METHOD_LABELS[value],
}));

// --- Contratos del cálculo (src/lib/calculations/polygonal.ts) ---

/** Una estación tal como la consume el cálculo: ángulos ya en grados decimales. */
export interface StationInput {
  pointCode: string;
  /** Ángulo interno / horizontal o magnitud de la deflexión, en grados decimales. */
  angle: number;
  /** Sentido de la deflexión (solo poligonal abierta con control). */
  deflectionDirection: DeflectionDirection | null;
  /** Distancia horizontal del lado, en metros. */
  distance: number;
}

export interface PolygonalInput {
  type: PolygonalType;
  startNorth: number;
  startEast: number;
  /** Azimut de partida en grados decimales. */
  startAzimuth: number;
  /** Punto de llegada conocido (solo open_controlled). */
  endNorth: number | null;
  endEast: number | null;
  endAzimuth: number | null;
  /** Orden de precisión del proyecto, para la tolerancia. */
  order: PrecisionOrder;
  method: CorrectionMethod;
  stations: StationInput[];
}

/** Resultados por estación (columnas calculadas de polygonal_stations). */
export interface StationResult {
  pointCode: string;
  correctedAngle: number | null;
  azimuth: number | null;
  deltaNorth: number | null;
  deltaEast: number | null;
  correctedDeltaNorth: number | null;
  correctedDeltaEast: number | null;
  north: number | null;
  east: number | null;
}

export interface PolygonalResult {
  // Verificación angular
  angleSum: number | null;
  theoreticalSum: number | null;
  angularError: number | null; // segundos de arco
  angularTolerance: number | null; // segundos de arco
  anglesMeetTolerance: boolean | null;
  // Cierre lineal
  errorNorth: number | null;
  errorEast: number | null;
  linearError: number | null;
  perimeter: number;
  relativePrecision: number | null; // el X de 1:X
  meetsLinearTolerance: boolean | null;
  // Global
  meetsTolerance: boolean | null;
  stations: StationResult[];
}
