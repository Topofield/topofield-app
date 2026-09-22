// Tipos de dominio de proyectos y puntos de referencia.
//
// La DB devuelve los campos con CHECK constraint como `string` plano (ver
// database.ts autogenerado). Aquí se estrechan a sus literales y se centralizan
// las etiquetas en español, para no dispersar strings por componentes.

import type { Tables } from "./database";

// --- Literales de los CHECK constraints del schema (PRD § 3.2) ---

export const PRECISION_ORDERS = [
  "primer_orden",
  "segundo_orden",
  "tercer_orden",
  "ordinario",
] as const;
export type PrecisionOrder = (typeof PRECISION_ORDERS)[number];

export const LEVEL_TYPES = ["automatico", "digital"] as const;
export type LevelType = (typeof LEVEL_TYPES)[number];

export const LEVEL_TYPE_LABELS: Record<LevelType, string> = {
  automatico: "Automático",
  digital: "Digital / electrónico",
};

export const LEVEL_TYPE_OPTIONS = LEVEL_TYPES.map((value) => ({
  value,
  label: LEVEL_TYPE_LABELS[value],
}));

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const REFERENCE_POINT_TYPES = [
  "bm",
  "control",
  "gps",
  "detail",
] as const;
export type ReferencePointType = (typeof REFERENCE_POINT_TYPES)[number];

// --- Filas tipadas: estrechan los campos string de la DB a sus literales ---

export type Project = Omit<Tables<"projects">, "status"> & {
  status: ProjectStatus;
};

export type ReferencePoint = Omit<Tables<"reference_points">, "type"> & {
  type: ReferencePointType;
};

// --- Etiquetas en español ---

export const PRECISION_ORDER_LABELS: Record<PrecisionOrder, string> = {
  primer_orden: "Primer orden",
  segundo_orden: "Segundo orden",
  tercer_orden: "Tercer orden",
  ordinario: "Ordinario",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Activo",
  archived: "Archivado",
};

export const REFERENCE_POINT_TYPE_LABELS: Record<ReferencePointType, string> = {
  bm: "BM",
  control: "Control",
  gps: "GPS",
  detail: "Detalle",
};

// --- Opciones para <Select> (value + label) ---

export const REFERENCE_POINT_TYPE_OPTIONS = REFERENCE_POINT_TYPES.map(
  (value) => ({ value, label: REFERENCE_POINT_TYPE_LABELS[value] }),
);

// --- Estado de UI del equipo, compartido por poligonal, nivelación y
// asentamientos (el informe y el export lo leen sin depender de esos
// módulos) ---

/**
 * Equipo de estación total tal como lo captura el formulario (todo texto).
 * Vive aquí y no en `polygonal.ts` porque el informe y el export lo leen sin
 * depender del módulo.
 */
export interface TotalStationFields {
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  angularPrecisionSeconds: string;
  distancePrecisionMm: string;
  distancePrecisionPpm: string;
}

export const EMPTY_TOTAL_STATION: TotalStationFields = {
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
  equipmentCalibrationDate: "",
  angularPrecisionSeconds: "",
  distancePrecisionMm: "",
  distancePrecisionPpm: "",
};

/** Equipo de nivel, para nivelación y para visitas de asentamiento. */
export interface LevelFields {
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentCalibrationDate: string;
  levelType: LevelType | "";
  kmPrecisionMm: string;
}

export const EMPTY_LEVEL: LevelFields = {
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
  equipmentCalibrationDate: "",
  levelType: "",
  kmPrecisionMm: "",
};
