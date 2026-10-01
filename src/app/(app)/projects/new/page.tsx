import { Breadcrumbs, Card } from "@/components/design-system";
import { NewProjectForm } from "@/components/projects/new-project-form";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Nuevo proyecto" },
        ]}
      />
      <h1 className="mt-2 text-2xl font-bold">
        Nuevo proyecto
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        Los datos del proyecto y su sistema de referencia. El equipo y el orden
        de precisión se declaran en cada proceso.
      </p>
      <Card className="mt-6">
        <NewProjectForm />
      </Card>
    </div>
  );
}
