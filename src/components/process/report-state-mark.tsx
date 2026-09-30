import type { ProcessReportState } from "@/lib/reports/state";

/**
 * La marca del informe de un proceso según su estado (Fase 24), también en el
 * PDF. Hasta la Fase 23 un rechazado llevaba la de borrador, aunque ya estaba
 * cerrado para siempre.
 */
export function ReportStateMark({ state }: { state: ProcessReportState }) {
  if (state === "draft") {
    return (
      <p className="report-draft">Borrador — el informe se emite al cerrar el proceso</p>
    );
  }
  if (state === "rejected") {
    return (
      <p className="report-rejected">
        Rechazado — el proceso no alcanzó la tolerancia; queda como constancia y no
        entra en informes consolidados
      </p>
    );
  }
  return null;
}
