// Tono del badge de estado de procesos y visitas (Fase 22).
//
// Estaba copiado en seis componentes —los dos editores, la tabla y la tarjeta
// del hub, la vista y la tabla de visitas—. Las etiquetas siguen junto a sus
// tipos (`PROCESS_STATUS_LABELS`, `VISIT_STATUS_LABELS`); aquí solo vive el
// color, que es decisión de la interfaz. El lugar no tiene estado (Fase 37).

import type { ProcessStatus } from "@/types/polygonal";
import type { VisitStatus } from "@/types/settlement";

/** Los tonos de `Badge`. */
export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger";

export const PROCESS_STATUS_TONE: Record<ProcessStatus, StatusTone> = {
  draft: "neutral",
  in_progress: "neutral",
  calculated: "primary",
  closed: "success",
  rejected: "danger",
};

export const VISIT_STATUS_TONE: Record<VisitStatus, StatusTone> = {
  draft: "neutral",
  in_progress: "neutral",
  calculated: "primary",
};
