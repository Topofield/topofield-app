import type { Tables } from "./database";
import type { LevelType } from "./project";

/** Tipos de equipo del catálogo (Fase 25). */
export const EQUIPMENT_KINDS = ["total_station", "level"] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export const EQUIPMENT_KIND_LABELS: Record<EquipmentKind, string> = {
  total_station: "Estación total",
  level: "Nivel",
};

/** Fila de `equipment`, con `kind` y `level_type` ya tipados. */
export type Equipment = Omit<Tables<"equipment">, "kind" | "level_type"> & {
  kind: EquipmentKind;
  level_type: LevelType | null;
};
