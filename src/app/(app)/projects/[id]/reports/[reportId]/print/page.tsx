import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getReport } from "@/lib/supabase/queries";
import { loadReportSections } from "@/lib/reports/sections";
import { precisionSummaryRows } from "@/lib/reports/summary";
import { formatDate } from "@/lib/utils/format";
import { CANDIDATE_KIND_LABELS } from "@/types/report";
import { PrintButton } from "@/components/reports/print-button";
import { ClosureRecord } from "@/components/reports/sections/closure-record";
import { PrecisionSummary } from "@/components/reports/sections/precision-summary";
import { ReportProcessSection } from "@/components/reports/sections/process-section";
import { ReportCover } from "@/components/reports/sections/report-cover";

interface PrintPageProps {
  params: Promise<{ id: string; reportId: string }>;
}

/**
 * Ruta imprimible del informe consolidado (§ 4.7).
 *
 * El PDF se produce con «Imprimir → Guardar como PDF» del navegador sobre esta
 * página: no hay motor de PDF en el servidor. La maquetación vive en
 * `@media print`, que oculta la navegación de la aplicación.
 *
 * El contenido se **reconstruye** en cada visita a partir de los procesos que
 * el informe referencia. Es seguro porque solo puede incluir procesos
 * cerrados, cuyas mediciones y veredicto son inmutables por trigger de base.
 * La excepción es la posición de una poligonal georreferenciada después
 * (Fase 15): el informe muestra las coordenadas nuevas, con una nota.
 *
 * Las secciones son las mismas que arma la pestaña Informe de cada proceso
 * (`components/reports/sections/`, Fase 22).
 */
export default async function ReportPrintPage({ params }: PrintPageProps) {
  const { id, reportId } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) notFound();

  const report = await getReport(supabase, reportId);
  if (!report || report.project_id !== project.id) notFound();

  const entries = [...report.included_processes].sort((a, b) => a.order - b.order);
  const sections = await loadReportSections(supabase, project.id, entries);

  return (
    <div className="report">
      <PrintButton />

      <ReportCover title={report.title} project={project} date={report.generated_at} />

      <section className="report-section">
        <h2>Índice de procesos incluidos</h2>
        <ol className="report-index">
          {sections.map((s, i) => (
            <li key={`${s.entry.type}:${s.entry.id}`}>
              <span className="report-index-kind">{CANDIDATE_KIND_LABELS[s.entry.type]}</span>
              <span>{s.entry.name}</span>
              <span className="report-index-num">{i + 1}</span>
            </li>
          ))}
        </ol>
      </section>

      {sections.map((section, i) => (
        <ReportProcessSection
          key={`${section.entry.type}:${section.entry.id}`}
          section={section}
          number={i + 1}
        />
      ))}

      <PrecisionSummary rows={precisionSummaryRows(sections)} />

      {report.observations && (
        <section className="report-section">
          <h2>Observaciones</h2>
          <p className="report-observations">{report.observations}</p>
        </section>
      )}

      <ClosureRecord
        sections={sections}
        footer={
          <>
            Informe emitido desde TopoField el{" "}
            {report.generated_at ? formatDate(report.generated_at) : "—"}. El contenido procede de
            procesos cerrados, cuyas mediciones y veredicto son inmutables desde su cierre.
          </>
        }
      />
    </div>
  );
}
