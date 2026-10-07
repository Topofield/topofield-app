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

/**
 * `grouping`: agrupa poligonales y nivelaciones y no se muestra como lugar;
 * `settlement`: control de asentamientos (Fase 22).
 */
export const SITE_KINDS = ["grouping", "settlement"] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

/**
 * Un lugar. Desde la Fase 37 no tiene estado: `status`, `closed_at` y
 * `closed_by` quedan fuera del tipo hasta que la migración los borre.
 */
export type Site = Omit<Tables<"sites">, "structure_type" | "status" | "kind" | "closed_at" | "closed_by"> & {
  structure_type: StructureType;
  kind: SiteKind;
};

export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  edificio: "Edificio",
  presa: "Presa",
  terraplen: "Terraplén",
  otro: "Otro",
};

