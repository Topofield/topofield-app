// Tipos de dominio del lugar (`sites`) — la entidad transversal introducida en
// la Fase 5. Literales de los CHECK del schema, etiquetas en español y la fila
// tipada. Ver docs/prds/04-asentamientos.md, decisiones #1 y #6.

import type { Tables } from "./database";

export const STRUCTURE_TYPES = [
  "edificio",
  "presa",
  "terraplen",
  "otro",
] as const;
export type StructureType = (typeof STRUCTURE_TYPES)[number];

export const SITE_STATUSES = ["active", "closed"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

/**
 * `grouping`: agrupa poligonales y nivelaciones y no se muestra como lugar;
 * `settlement`: control de asentamientos (Fase 22).
 */
export const SITE_KINDS = ["grouping", "settlement"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export type Site = Omit<Tables<"sites">, "structure_type" | "status" | "kind"> & {
  structure_type: StructureType;
  status: SiteStatus;
  kind: SiteKind;
};

export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  edificio: "Edificio",
  presa: "Presa",
  terraplen: "Terraplén",
  otro: "Otro",
};

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  active: "Activo",
  closed: "Cerrado",
};
