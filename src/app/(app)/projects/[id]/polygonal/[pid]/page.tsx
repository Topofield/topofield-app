import { notFound } from "next/navigation";
import { DatosTab } from "@/components/polygonal/datos-tab";
import { PolygonalHeader } from "@/components/polygonal/polygonal-header";
import { PolygonalSteps, type PolygonalStep } from "@/components/polygonal/polygonal-steps";
import { ProcessReport } from "@/components/process/process-report";
import { processReportState } from "@/lib/reports/state";
import { reportsIncluding } from "@/lib/reports/including";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
  getReports,
} from "@/lib/supabase/queries";

interface PolygonalPageProps {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function stepOf(tab: string | undefined): PolygonalStep {
  return tab === "ajuste" || tab === "informe" ? tab : "datos";
}

/**
 * Pantalla de una poligonal (Fase 35): la cabecera con los datos del alta y
 * tres pasos —1 · Datos, 2 · Ajuste, 3 · Informe—. `?tab=proceso`, de los
 * enlaces de antes, lleva a Datos.
 */
export default async function PolygonalPage({ params, searchParams }: PolygonalPageProps) {
  const { id, pid } = await params;
  const { tab } = await searchParams;
  const step = stepOf(tab);

  const supabase = await createClient();
  const process = await getPolygonalProcess(supabase, pid);
  if (!process || process.project_id !== id) notFound();

  const [stations, project, referencePoints, reports] = await Promise.all([
    getPolygonalStations(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
    getReports(supabase, id),
  ]);
  if (!project) notFound();

  const basePath = `/projects/${id}/polygonal/${pid}`;
  const reportTitles = reportsIncluding(reports, "polygonal", process.id).map((r) => r.title);

  return (
    <div className="flex flex-col gap-5">
      <PolygonalHeader
        projectId={id}
        projectName={project.name}
        process={process}
        stations={stations}
        exportHref={`${basePath}/export`}
        reportTitles={reportTitles}
      />
      <PolygonalSteps
        basePath={basePath}
        active={step}
        processId={process.id}
        angleFormat={process.angle_input_format}
      />
      {step === "informe" ? (
        <ProcessReport
          project={project}
          process={{ type: "polygonal", id: process.id, name: process.name }}
          state={processReportState(process.status)}
          notes={process.notes}
          reports={reports}
        />
      ) : (
        <DatosTab
          projectId={id}
          process={process}
          stations={stations}
          referencePoints={referencePoints}
          angleFormat={process.angle_input_format}
        />
      )}
    </div>
  );
}
