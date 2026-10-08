import { PrecisionSummary } from "@/components/reports/sections/precision-summary";
import { ReportProcessSection } from "@/components/reports/sections/process-section";
import { ReportCover } from "@/components/reports/sections/report-cover";
import { coverOf } from "@/lib/reports/cover";
import { pageFooterCss } from "@/lib/reports/page-footer";
import { loadReportSections } from "@/lib/reports/sections";
import { precisionSummaryRows } from "@/lib/reports/summary";
import { createClient } from "@/lib/supabase/server";
import type { Project } from "@/types/project";
import type { IncludedProcess } from "@/types/report";

interface ProcessReportProps {
  project: Project;
  /** El proceso: su tipo, su id y su nombre. */
  process: Pick<IncludedProcess, "type" | "id" | "name">;
  /** Notas del proceso, como observaciones. */
  notes?: string | null;
}

/**
 * El informe de un proceso (Fases 22 y 38): portada, datos y resultados,
 * resumen de precisión y observaciones, con las secciones de
 * `components/reports/sections`. Es función de los datos del proceso, con la
 * fecha del informe; no se guarda. Se exporta desde la cabecera de su página:
 * Exportar PDF y Exportar Excel.
 */
export async function ProcessReport({ project, process, notes }: ProcessReportProps) {
  const supabase = await createClient();
  const entry: IncludedProcess = { ...process, order: 0 };
  const sections = await loadReportSections(supabase, project.id, [entry]);
  const section = sections[0]!;
  const now = new Date().toISOString();

  return (
    <div className="report">
      <style>{pageFooterCss(project.name, process.name)}</style>
      <ReportCover title={process.name} cover={coverOf(project)} dateLabel="Fecha del informe" date={now} />

      <ReportProcessSection section={section} title="Datos y resultados" />

      <PrecisionSummary rows={precisionSummaryRows(sections)} title="Resumen de precisión" />

      {notes && (
        <section className="report-section">
          <h2>Observaciones</h2>
          <p className="report-observations">{notes}</p>
        </section>
      )}

    </div>
  );
}
