import { notFound } from "next/navigation";
import { Breadcrumbs, Card } from "@/components/design-system";
import { NewLevelingForm } from "@/components/leveling/new-leveling-form";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getReferencePoints } from "@/lib/supabase/queries";

interface NewLevelingPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewLevelingPage({
  params,
}: NewLevelingPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const points = await getReferencePoints(supabase, id);
  const bmPoints = points.filter((p) => p.type === "bm");

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Nueva nivelación" },
        ]}
      />
      <h1 className="mt-2 text-2xl font-bold">Nuevo proceso de nivelación</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Configura el proceso. Las lecturas de campo se capturan en el editor.
      </p>
      <Card className="mt-6">
        <NewLevelingForm
          projectId={id}
          points={bmPoints}
          precisionOrder={project.precision_order}
        />
      </Card>
    </div>
  );
}
