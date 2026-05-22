import Link from "next/link";
import { Card } from "@/components/design-system";
import { ProjectWizard } from "@/components/projects/project-wizard";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-primary-600"
      >
        ← Volver al dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">
        Nuevo proyecto
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Registra los datos del proyecto y del equipo en dos pasos.
      </p>
      <Card className="mt-6">
        <ProjectWizard />
      </Card>
    </div>
  );
}
