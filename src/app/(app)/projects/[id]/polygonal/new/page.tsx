import { notFound } from "next/navigation";
import { Breadcrumbs, Card } from "@/components/design-system";
import { NewPolygonalForm } from "@/components/polygonal/new-polygonal-form";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/supabase/queries";

interface NewPolygonalPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewPolygonalPage({
  params,
}: NewPolygonalPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Nueva poligonal" },
        ]}
      />
      <h1 className="mt-2 text-2xl font-bold">
        Nuevo proceso poligonal
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Configura el proceso. Los datos de campo se capturan en el editor.
      </p>
      <Card className="mt-6">
        <NewPolygonalForm projectId={id} />
      </Card>
    </div>
  );
}
