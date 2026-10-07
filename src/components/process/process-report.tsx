import Link from "next/link";
import { buttonClasses } from "@/components/design-system";
import { PrecisionSummary } from "@/components/reports/sections/precision-summary";
import { ReportProcessSection } from "@/components/reports/sections/process-section";
import { ReportCover } from "@/components/reports/sections/report-cover";
import { coverOf } from "@/lib/reports/cover";
import { reportsIncluding } from "@/lib/reports/including";
import { loadReportSections } from "@/lib/reports/sections";
import { precisionSummaryRows } from "@/lib/reports/summary";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import type { Project } from "@/types/project";
import type { IncludedProcess, Report } from "@/types/report";

interface ProcessReportProps {
  project: Project;
  /** El proceso, como lo referenciaría un informe consolidado. */
  process: Pick<IncludedProcess, "type" | "id" | "name">;
  /** Notas del proceso, como observaciones. */
  notes?: string | null;
  /** Los informes del proyecto, para listar los consolidados que lo incluyen. */
  reports: Report[];
  /**
   * ¿Puede entrar en un consolidado? Calculado: la poligonal y la nivelación
   * (Fases 35 y 36), o el lugar con alguna visita calculada (Fase 37).
   */
  includable: boolean;
}

/**
 * La pestaña Informe de un proceso (Fase 22): el informe de ese proceso solo,
 * con las mismas secciones que el consolidado (`components/reports/sections`).
 *
 * No crea fila en `reports`: es función de los datos del proceso (decisión 2
 * del PRD). Ningún proceso se cierra (Fases 35, 36 y 37): sin marca de
 * borrador ni registro de cierre, con la fecha del informe. Debajo, fuera de
 * la impresión, los informes consolidados que lo incluyen.
 */
export async function ProcessReport({ project, process, notes, reports, includable }: ProcessReportProps) {
  const supabase = await createClient();
  const entry: IncludedProcess = { ...process, order: 0 };
  const sections = await loadReportSections(supabase, project.id, [entry]);
  const section = sections[0]!;
  const consolidated = reportsIncluding(reports, process.type, process.id);
  const now = new Date().toISOString();

  return (
    <div className="report">
      <ReportCover title={process.name} cover={coverOf(project)} dateLabel="Fecha del informe" date={now} />

      <ReportProcessSection section={section} title="Datos y resultados" />

      <PrecisionSummary rows={precisionSummaryRows(sections)} title="Resumen de precisión" />

      {notes && (
        <section className="report-section">
          <h2>Observaciones</h2>
          <p className="report-observations">{notes}</p>
        </section>
      )}

      <p className="report-footer">Informe generado desde TopoField el {formatDate(now)}.</p>

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
        {includable ? (
          <Link
            href={`/projects/${project.id}/reports/new?incluir=${process.type}:${process.id}`}
            className={`mt-4 ${buttonClasses({ variant: "secondary", size: "sm" })}`}
          >
            Generar un informe consolidado con este proceso
          </Link>
        ) : (
          <p className="mt-2 text-sm text-ink-2">
            {process.type === "polygonal"
              ? "Un informe consolidado incluye la poligonal cuando está calculada."
              : process.type === "leveling"
                ? "Un informe consolidado incluye la nivelación cuando su libreta está completa."
                : "Un informe consolidado incluye el lugar cuando tiene alguna visita calculada."}
          </p>
        )}
      </section>
    </div>
  );
}
