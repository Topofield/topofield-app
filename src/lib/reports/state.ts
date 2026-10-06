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

/**
 * El final del pie de un informe consolidado (Fase 34): «con procesos
 * cerrados» si todo lo que incluye sigue cerrado; si no, qué se reabrió
 * después de emitirlo, porque el informe muestra sus datos actuales.
 */
export function issuedFooterNote(reopened: string[]): string {
  if (reopened.length === 0) return ", con procesos cerrados.";
  const list = reopened.map((n) => `«${n}»`).join(", ");
  return reopened.length === 1
    ? `. ${list} se reabrió después de emitirlo: sus datos pueden cambiar.`
    : `. ${list} se reabrieron después de emitirlo: sus datos pueden cambiar.`;
}
