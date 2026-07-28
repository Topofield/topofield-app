import { notFound } from "next/navigation";
import {
  Breadcrumbs,
  EmptyState,
  Tabs,
  type SearchParams,
  type TabItem,
} from "@/components/design-system";
import { NewProcessSelector } from "@/components/projects/new-process-selector";
import { ProcessListToolbar } from "@/components/projects/process-list-toolbar";
import { ProcessTable } from "@/components/projects/process-table";
import { ProjectConfigTab } from "@/components/projects/project-config-tab";
import { ProjectHeader } from "@/components/projects/project-header";
import {
  countByStatus,
  filterProcesses,
  type ProcessFilters,
  type SortKey,
  type StatusFilter,
} from "@/lib/process-list";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcesses,
  getProjectById,
  getReferencePoints,
} from "@/lib/supabase/queries";
import { POLYGONAL_TYPES, type PolygonalType } from "@/types/polygonal";

const TABS: TabItem[] = [
  { id: "processes", label: "Procesos" },
  { id: "reports", label: "Informes" },
  { id: "config", label: "Configuración" },
];

const STATUS_FILTERS: StatusFilter[] = [
  "todos",
  "borradores",
  "calculados",
  "cerrados",
  "rechazados",
];
const SORT_KEYS: SortKey[] = ["actividad", "nombre", "precision"];

interface ProjectHubPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

export default async function ProjectHubPage({
  params,
  searchParams,
}: ProjectHubPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab;
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

  const filters: ProcessFilters = {
    q: typeof sp.q === "string" ? sp.q : "",
    estado: STATUS_FILTERS.includes(sp.estado as StatusFilter)
      ? (sp.estado as StatusFilter)
      : "todos",
    tipo: POLYGONAL_TYPES.includes(sp.tipo as PolygonalType)
      ? (sp.tipo as PolygonalType)
      : "todos",
    orden: SORT_KEYS.includes(sp.orden as SortKey)
      ? (sp.orden as SortKey)
      : "actividad",
    dir: sp.dir === "asc" ? "asc" : "desc",
  };

  const visibles = filterProcesses(processes, filters);
  const counts = countByStatus(processes);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name },
        ]}
      />
      <ProjectHeader project={project} />
      <Tabs
        items={TABS}
        activeId={activeTab}
        basePath={`/projects/${project.id}`}
        searchParams={sp}
      />

      {activeTab === "processes" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">
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
            <div className="flex flex-col gap-4">
              <ProcessListToolbar
                projectId={project.id}
                filters={filters}
                counts={counts}
              />
              {visibles.length === 0 ? (
                <EmptyState
                  title="Ningún proceso coincide"
                  description="Ajusta la búsqueda o los filtros para ver otros procesos."
                />
              ) : (
                <ProcessTable
                  projectId={project.id}
                  processes={visibles}
                  filters={filters}
                />
              )}
            </div>
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
