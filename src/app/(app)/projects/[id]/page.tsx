import { notFound } from "next/navigation";
import { Button, EmptyState, Tabs, type TabItem } from "@/components/design-system";
import { ProjectConfigTab } from "@/components/projects/project-config-tab";
import { ProjectHeader } from "@/components/projects/project-header";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getReferencePoints } from "@/lib/supabase/queries";

const TABS: TabItem[] = [
  { id: "processes", label: "Procesos" },
  { id: "reports", label: "Informes" },
  { id: "config", label: "Configuración" },
];

interface ProjectHubPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectHubPage({
  params,
  searchParams,
}: ProjectHubPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab =
    tab === "reports" || tab === "config" ? tab : "processes";

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const referencePoints =
    activeTab === "config"
      ? await getReferencePoints(supabase, project.id)
      : [];

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader project={project} />
      <Tabs
        items={TABS}
        activeId={activeTab}
        basePath={`/projects/${project.id}`}
      />

      {activeTab === "processes" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Procesos
            </h2>
            <Button
              disabled
              title="Disponible al implementar los módulos de proceso."
            >
              + Nuevo Proceso
            </Button>
          </div>
          <EmptyState
            title="Aún no hay procesos"
            description="Los editores de poligonal, nivelación y asentamientos se construyen en las próximas fases."
          />
        </div>
      )}

      {activeTab === "reports" && (
        <EmptyState
          title="Aún no hay informes"
          description="El generador de informes se construye en la última fase."
        />
      )}

      {activeTab === "config" && (
        <ProjectConfigTab
          project={project}
          referencePoints={referencePoints}
        />
      )}
    </div>
  );
}
