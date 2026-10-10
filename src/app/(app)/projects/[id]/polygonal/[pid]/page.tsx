import { notFound } from "next/navigation";
import { AjusteTab } from "@/components/polygonal/ajuste-tab";
import { DatosTab } from "@/components/polygonal/datos-tab";
import { PolygonalHeader } from "@/components/polygonal/polygonal-header";
import { PolygonalSteps, type PolygonalStep } from "@/components/polygonal/polygonal-steps";
import { ProcessReport } from "@/components/process/process-report";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalAmarres,
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
  getRouteMenus,
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

  const basePath = `/projects/${id}/polygonal/${pid}`;
  const [stations, project, referencePoints, processes, menus] = await Promise.all([
    getPolygonalStations(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
    // Para el aviso del amarre: qué otras poligonales usan un punto que se corrige.
    step === "datos" ? getPolygonalAmarres(supabase, id) : Promise.resolve([]),
    getRouteMenus(supabase, id, basePath),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PolygonalHeader
        projectId={id}
        projectName={project.name}
        menus={menus}
        process={process}
        stations={stations}
        exportHref={`${basePath}/export`}
        printable={step === "informe"}
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
          notes={process.notes}
        />
      ) : step === "ajuste" ? (
        <AjusteTab
          process={process}
          stations={stations}
          referencePoints={referencePoints}
          angleFormat={process.angle_input_format}
          basePath={basePath}
        />
      ) : (
        <DatosTab
          process={process}
          stations={stations}
          referencePoints={referencePoints}
          others={processes
            .filter((p) => p.id !== process.id)
            .map((p) => ({
              name: p.name,
              startCode: p.start_point_code,
              endCode: p.end_point_code,
              referencePointId: p.reference_point_id,
            }))}
          angleFormat={process.angle_input_format}
        />
      )}
    </div>
  );
}
