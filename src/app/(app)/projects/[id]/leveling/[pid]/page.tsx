import { notFound } from "next/navigation";
import { CompensacionTab } from "@/components/leveling/compensacion-tab";
import { LevelingHeader } from "@/components/leveling/leveling-header";
import { LibretaTab } from "@/components/leveling/libreta-tab";
import { LevelingSteps, type LevelingStep } from "@/components/leveling/leveling-steps";
import { ProcessReport } from "@/components/process/process-report";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
  getRouteMenus,
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

  const basePath = `/projects/${id}/leveling/${pid}`;
  const [readings, project, menus] = await Promise.all([
    getLevelingReadings(supabase, pid),
    getProjectById(supabase, id),
    getRouteMenus(supabase, id, basePath),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-5">
      <LevelingHeader
        projectId={id}
        projectName={project.name}
        menus={menus}
        process={process}
        readings={readings}
        exportHref={`${basePath}/export`}
        printable={step === "informe"}
      />
      <LevelingSteps basePath={basePath} active={step} process={process} readings={readings} />
      {step === "informe" ? (
        <ProcessReport
          project={project}
          process={{ type: "leveling", id: process.id, name: process.name }}
          notes={process.notes}
        />
      ) : step === "compensacion" ? (
        <CompensacionTab process={process} readings={readings} />
      ) : (
        <LibretaTab process={process} readings={readings} />
      )}
    </div>
  );
}
