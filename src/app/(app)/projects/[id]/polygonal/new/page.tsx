import Link from "next/link";
import { Card } from "@/components/design-system";
import { NewPolygonalForm } from "@/components/polygonal/new-polygonal-form";

interface NewPolygonalPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewPolygonalPage({
  params,
}: NewPolygonalPageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/projects/${id}?tab=processes`}
        className="text-sm font-medium text-primary-600"
      >
        ← Volver al proyecto
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">
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
