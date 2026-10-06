import Link from "next/link";
import { buttonClasses } from "@/components/design-system";
import { ClosureRecord } from "@/components/reports/sections/closure-record";
import { PrecisionSummary } from "@/components/reports/sections/precision-summary";
import { ReportProcessSection } from "@/components/reports/sections/process-section";
import { ReportCover } from "@/components/reports/sections/report-cover";
import { coverOf } from "@/lib/reports/cover";
import type { ProcessReportState } from "@/lib/reports/state";
import { reportsIncluding } from "@/lib/reports/including";
import { responsibleNames } from "@/lib/reports/responsible";
import { closureOf, loadReportSections } from "@/lib/reports/sections";
import { precisionSummaryRows } from "@/lib/reports/summary";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import type { Project } from "@/types/project";
import type { IncludedProcess, Report } from "@/types/report";
import { ReportStateMark } from "./report-state-mark";

interface ProcessReportProps {
  project: Project;
  /** El proceso, como lo referenciaría un informe consolidado. */
  process: Pick<IncludedProcess, "type" | "id" | "name">;
  /**
   * Borrador mientras se edita; cerrado, el emitido; rechazado, cerrado pero
   * fuera de los consolidados (Fase 24, `processReportState`).
   */
  state: ProcessReportState;
  /** Notas del proceso, como observaciones. */
  notes?: string | null;
  /**
   * Los informes del proyecto. Los pide la página, que también los usa para
   * el diálogo de reabrir (Fase 34): así se consultan una sola vez.
   */
  reports: Report[];
}

/**
 * La pestaña Informe de un proceso (Fase 22): el informe de ese proceso solo,
 * con las mismas secciones que el consolidado (`components/reports/sections`).
 *
 * No crea fila en `reports`: es función de los datos del proceso (decisión 2
 * del PRD). Sin cerrar, lleva la marca de borrador, también en el PDF. Debajo,
 * fuera de la impresión, los informes consolidados que lo incluyen.
 */
export async function ProcessReport({
  project,
  process,
  state,
  notes,
  reports,
}: ProcessReportProps) {
  // Cerrado conforme o rechazado: no cambia mientras siga cerrado, y tiene fecha
  // y registro de cierre.
  const closed = state !== "draft";
  const supabase = await createClient();
  const entry: IncludedProcess = { ...process, order: 0 };
  const sections = await loadReportSections(supabase, project.id, [entry]);
  const names = await responsibleNames(
    supabase,
    sections.map((s) => closureOf(s).closedBy),
  );
  const section = sections[0]!;
  const { closedAt } = closureOf(section);
  const consolidated = reportsIncluding(reports, process.type, process.id);
  const now = new Date().toISOString();

  return (
    <div className="report">
      <ReportStateMark state={state} />

      <ReportCover
        title={process.name}
        cover={coverOf(project)}
        dateLabel={closed ? "Fecha de cierre" : "Fecha"}
        date={closed ? closedAt : now}
      />

      <ReportProcessSection section={section} title="Datos y resultados" />

      <PrecisionSummary rows={precisionSummaryRows(sections)} title="Resumen de precisión" />

      {notes && (
        <section className="report-section">
          <h2>Observaciones</h2>
          <p className="report-observations">{notes}</p>
        </section>
      )}

      {closed ? (
        <ClosureRecord
          sections={sections}
          names={names}
          footer={<>Informe generado desde TopoField el {formatDate(now)}.</>}
        />
      ) : (
        <p className="report-footer">
          Borrador generado desde TopoField el {formatDate(now)}. El proceso no está cerrado:
          sus datos todavía pueden cambiar.
        </p>
      )}

      {/* Fuera de la impresión: el informe del proceso en los consolidados. */}
      <section className="report-section print:hidden">
        <h2>Informes consolidados</h2>
        {consolidated.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {consolidated.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/projects/${project.id}/reports/${r.id}/print`}
                  className="text-mira-ink underline-offset-2 hover:underline"
                >
                  {r.title}
                </Link>
                {r.generated_at && (
                  <span className="text-sm text-ink-2"> · {formatDate(r.generated_at)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-2">Este proceso no está en ningún informe consolidado.</p>
        )}
        {state === "closed" ? (
          <Link
            href={`/projects/${project.id}/reports/new?incluir=${process.type}:${process.id}`}
            className={`mt-4 ${buttonClasses({ variant: "secondary", size: "sm" })}`}
          >
            Generar un informe consolidado con este proceso
          </Link>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {state === "rejected"
              ? "Un informe consolidado no incluye procesos rechazados."
              : "Un informe consolidado solo incluye procesos cerrados."}
          </p>
        )}
      </section>
    </div>
  );
}
