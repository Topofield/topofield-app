import { notFound } from "next/navigation";
import { PolygonalEditor } from "@/components/polygonal/polygonal-editor";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
} from "@/lib/supabase/queries";

interface PolygonalEditorPageProps {
  params: Promise<{ id: string; pid: string }>;
}

export default async function PolygonalEditorPage({
  params,
}: PolygonalEditorPageProps) {
  const { id, pid } = await params;

  const supabase = await createClient();
  const process = await getPolygonalProcess(supabase, pid);
  if (!process || process.project_id !== id) {
    notFound();
  }

  const [stations, project, referencePoints] = await Promise.all([
    getPolygonalStations(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
  ]);
  if (!project) {
    notFound();
  }

  return (
    <PolygonalEditor
      process={process}
      stations={stations}
      projectId={id}
      projectName={project.name}
      referencePoints={referencePoints}
      // `NaN` y no `0` cuando el proceso no declaró precisión angular: la
      // columna es nullable y `Number(null)` es 0, no NaN, de modo que la
      // tolerancia de dispersión salía 0" y avisaba en toda estación con dos
      // lecturas distintas. `validateReadings` salta el control si no es
      // finito.
      angularPrecisionSeconds={
        process.angular_precision_seconds == null
          ? Number.NaN
          : Number(process.angular_precision_seconds)
      }
    />
  );
}
