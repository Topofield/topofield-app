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
 * Los procesos que se cierran y ya no lo están: se reabrieron después de
 * emitir el informe (Fase 34). La poligonal (Fase 35) y la nivelación (Fase
 * 36) no se cierran y no cuentan: solo los lugares.
 */
export function reopenedAfterIssue(
  items: { kind: string; name: string; closedAt: string | null }[],
): string[] {
  return items.filter((i) => i.kind === "site" && i.closedAt == null).map((i) => i.name);
}

/**
 * El final del pie de un informe consolidado (Fase 34): «con procesos
 * cerrados» si todo lo que incluye sigue cerrado; si no, qué se reabrió
 * después de emitirlo, porque el informe muestra sus datos actuales.
 * `closable`: cuántos de sus procesos se cierran (solo los lugares).
 */
export function issuedFooterNote(reopened: string[], closable = 1): string {
  // Un informe sin lugares no tiene procesos cerrados (Fases 35 y 36).
  if (reopened.length === 0) return closable === 0 ? "." : ", con procesos cerrados.";
  const list = reopened.map((n) => `«${n}»`).join(", ");
  return reopened.length === 1
    ? `. ${list} se reabrió después de emitirlo: sus datos pueden cambiar.`
    : `. ${list} se reabrieron después de emitirlo: sus datos pueden cambiar.`;
}
