import { notFound } from "next/navigation";
import { LevelingEditor } from "@/components/leveling/leveling-editor";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
  getReferencePoints,
} from "@/lib/supabase/queries";

interface LevelingEditorPageProps {
  params: Promise<{ id: string; pid: string }>;
}

export default async function LevelingEditorPage({
  params,
}: LevelingEditorPageProps) {
  const { id, pid } = await params;

  const supabase = await createClient();
  const process = await getLevelingProcess(supabase, pid);
  if (!process || process.project_id !== id) {
    notFound();
  }

  const [readings, project, points] = await Promise.all([
    getLevelingReadings(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
  ]);
  if (!project) {
    notFound();
  }

  return (
    <LevelingEditor
      process={process}
      readings={readings}
      projectId={id}
      projectName={project.name}
      points={points}
      precisionOrder={project.precision_order}
    />
  );
}
