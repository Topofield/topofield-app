import { notFound } from "next/navigation";
import { EmptyState, Tabs, type TabItem } from "@/components/design-system";
import { NewProcessSelector } from "@/components/projects/new-process-selector";
import { ProcessCard } from "@/components/projects/process-card";
import { ProjectConfigTab } from "@/components/projects/project-config-tab";
import { ProjectHeader } from "@/components/projects/project-header";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcesses,
  getProjectById,
  getReferencePoints,
} from "@/lib/supabase/queries";
import type { PolygonalProcess } from "@/types/polygonal";

const TABS: TabItem[] = [
  { id: "processes", label: "Procesos" },
  { id: "reports", label: "Informes" },
  { id: "config", label: "Configuración" },
];

interface ProjectHubPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function ProcessSection({
  title,
  projectId,
  processes,
  emptyText,
}: {
  title: string;
  projectId: string;
  processes: PolygonalProcess[];
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {processes.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {processes.map((process) => (
            <ProcessCard
              key={process.id}
              projectId={projectId}
              process={process}
            />
          ))}
        </div>
      )}
    </section>
  );
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

  const processes =
    activeTab === "processes"
      ? await getPolygonalProcesses(supabase, project.id)
      : [];
  const referencePoints =
    activeTab === "config"
      ? await getReferencePoints(supabase, project.id)
      : [];

  const drafts = processes.filter(
    (p) => p.status === "draft" || p.status === "in_progress",
  );
  const calculated = processes.filter((p) => p.status === "calculated");
  const closed = processes.filter((p) => p.status === "closed");
  const rejected = processes.filter((p) => p.status === "rejected");

  return (
    <div className="flex flex-col gap-6">
      <ProjectHeader project={project} />
      <Tabs
        items={TABS}
        activeId={activeTab}
        basePath={`/projects/${project.id}`}
      />

      {activeTab === "processes" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Procesos
            </h2>
            <NewProcessSelector projectId={project.id} />
          </div>
          {processes.length === 0 ? (
            <EmptyState
              title="Aún no hay procesos"
              description="Crea el primer proceso topográfico del proyecto con «+ Nuevo Proceso»."
            />
          ) : (
            <>
              <ProcessSection
                title="Borradores"
                projectId={project.id}
                processes={drafts}
                emptyText="No hay borradores."
              />
              <ProcessSection
                title="Calculados"
                projectId={project.id}
                processes={calculated}
                emptyText="No hay procesos calculados."
              />
              <ProcessSection
                title="Cerrados"
                projectId={project.id}
                processes={closed}
                emptyText="No hay procesos cerrados."
              />
              <ProcessSection
                title="Rechazados"
                projectId={project.id}
                processes={rejected}
                emptyText="No hay procesos rechazados."
              />
            </>
          )}
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
