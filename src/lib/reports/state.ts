// En qué estado está el informe de un proceso (Fase 24).

/**
 * `draft` mientras el proceso se puede editar; `closed` si se cerró conforme
 * —el informe es el emitido y puede entrar en un consolidado—; `rejected` si
 * se cerró como rechazado: queda como constancia y no entra en ningún
 * consolidado (`eligibility.ts`). Un lugar de asentamientos solo tiene
 * `active` y `closed`.
 */
export type ProcessReportState = "draft" | "closed" | "rejected";

export function processReportState(status: string): ProcessReportState {
  if (status === "closed") return "closed";
  if (status === "rejected") return "rejected";
  return "draft";
}
