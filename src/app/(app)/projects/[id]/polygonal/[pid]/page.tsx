import { notFound } from "next/navigation";
import { PolygonalEditor } from "@/components/polygonal/polygonal-editor";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
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

  const [stations, project] = await Promise.all([
    getPolygonalStations(supabase, pid),
    getProjectById(supabase, id),
  ]);
  if (!project) {
    notFound();
  }

  return (
    <PolygonalEditor
      process={process}
      stations={stations}
      projectId={id}
      precisionOrder={project.precision_order}
    />
  );
}
