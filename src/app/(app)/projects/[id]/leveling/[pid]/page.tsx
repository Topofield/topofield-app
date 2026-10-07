import { notFound } from "next/navigation";
import { LevelingHeader } from "@/components/leveling/leveling-header";
import { LibretaTab } from "@/components/leveling/libreta-tab";
import { LevelingSteps, type LevelingStep } from "@/components/leveling/leveling-steps";
import { ProcessReport } from "@/components/process/process-report";
import { reportsIncluding } from "@/lib/reports/including";
import { processReportState } from "@/lib/reports/state";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
  getReports,
} from "@/lib/supabase/queries";

interface LevelingPageProps {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function stepOf(tab: string | undefined): LevelingStep {
  return tab === "compensacion" || tab === "informe" ? tab : "libreta";
}

/**
 * Pantalla de una nivelación (Fase 36): la cabecera con los datos del alta y
 * tres pasos —1 · Libreta, 2 · Compensación, 3 · Informe—. `?tab=proceso`, de
 * los enlaces de antes, lleva a la libreta.
 */
export default async function LevelingPage({ params, searchParams }: LevelingPageProps) {
  const { id, pid } = await params;
  const { tab } = await searchParams;
  const step = stepOf(tab);

  const supabase = await createClient();
  const process = await getLevelingProcess(supabase, pid);
  if (!process || process.project_id !== id) notFound();

  const [readings, project, reports] = await Promise.all([
    getLevelingReadings(supabase, pid),
    getProjectById(supabase, id),
    getReports(supabase, id),
  ]);
  if (!project) notFound();

  const basePath = `/projects/${id}/leveling/${pid}`;
  const reportTitles = reportsIncluding(reports, "leveling", process.id).map((r) => r.title);

  return (
    <div className="flex flex-col gap-5">
      <LevelingHeader
        projectId={id}
        projectName={project.name}
        process={process}
        readings={readings}
        exportHref={`${basePath}/export`}
        reportTitles={reportTitles}
        printable={step === "informe"}
      />
      <LevelingSteps basePath={basePath} active={step} process={process} readings={readings} />
      {step === "informe" ? (
        <ProcessReport
          project={project}
          process={{ type: "leveling", id: process.id, name: process.name }}
          state={processReportState(process.status)}
          notes={process.notes}
          reports={reports}
        />
      ) : step === "libreta" ? (
        <LibretaTab process={process} readings={readings} />
      ) : (
        // Hasta la Tarea 10 de la Fase 36, que trae el paso de compensación.
        <p className="rounded-lg border border-rule bg-card px-6 py-10 text-center text-sm text-ink-2">
          La compensación se muestra aquí en la próxima versión.
        </p>
      )}
    </div>
  );
}
