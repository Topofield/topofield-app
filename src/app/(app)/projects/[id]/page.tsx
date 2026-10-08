import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  EmptyState,
  PageHeader,
  Tabs,
  type SearchParams,
  type TabItem,
} from "@/components/design-system";
import {
  levelingMetric,
  levelingRow,
  LEVELING_TYPE_OPTIONS,
  polygonalRow,
  POLYGONAL_TYPE_OPTIONS,
  POLYGONAL_CHIPS,
  LEVELING_CHIPS,
  SITE_CHIPS,
  siteItem,
  siteMetric,
  siteRow,
  SITE_TYPE_OPTIONS,
} from "@/components/projects/hub-rows";
import { NewProcessSelector } from "@/components/projects/new-process-selector";
import { ProcessListToolbar } from "@/components/projects/process-list-toolbar";
import { ProcessTable, type ProcessRow } from "@/components/projects/process-table";
import { ProjectConfigTab } from "@/components/projects/project-config-tab";
import { cn } from "@/lib/utils/cn";
import {
  countByStatus,
  filterProcesses,
  type ProcessFilters,
  type SortKey,
  type StatusCounts,
  type StatusFilter,
} from "@/lib/process-list";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcesses,
  getPolygonalProcesses,
  getProjectById,
  getReferencePoints,
  getSiteSummariesByProject,
  getSites,
} from "@/lib/supabase/queries";
import { PROJECT_STATUS_LABELS } from "@/types/project";
import type { AlertLevel } from "@/types/settlement";

const TABS: TabItem[] = [
  { id: "processes", label: "Procesos" },
  { id: "config", label: "Configuración" },
];

type Modulo = "poligonales" | "nivelaciones" | "asentamientos";

const SUBTABS: { key: Modulo; label: string }[] = [
  { key: "poligonales", label: "Poligonales" },
  { key: "nivelaciones", label: "Nivelaciones" },
  { key: "asentamientos", label: "Control de Asentamientos" },
];

/**
 * Destino de un módulo. No conserva los filtros del anterior: los tipos y los
 * estados cambian de un módulo a otro.
 */
function subtabHref(projectId: string, modulo: Modulo): string {
  return `/projects/${projectId}?tab=processes&modulo=${modulo}`;
}

const EMPTY: Record<Modulo, { title: string; description: string }> = {
  poligonales: {
    title: "Aún no hay poligonales",
    description: "Crea la primera poligonal del proyecto con «+ Nuevo Proceso».",
  },
  nivelaciones: {
    title: "Aún no hay nivelaciones",
    description: "Crea la primera nivelación del proyecto con «+ Nuevo Proceso».",
  },
  asentamientos: {
    title: "Aún no hay controles de asentamientos",
    description: "Crea el primer lugar de control de asentamientos con «+ Nuevo Proceso».",
  },
};

const TYPE_LABEL: Record<Modulo, string> = {
  poligonales: "Filtrar por tipo de poligonal",
  nivelaciones: "Filtrar por tipo de nivelación",
  asentamientos: "Filtrar por tipo de estructura",
};

const RESULT_LABEL: Record<Modulo, string> = {
  poligonales: "Precisión",
  nivelaciones: "Cierre",
  asentamientos: "Alerta",
};

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
    tab === "config" ? tab : "processes";
  const modulo: Modulo =
    sp.modulo === "nivelaciones" || sp.modulo === "asentamientos"
      ? sp.modulo
      : "poligonales";

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  // Solo se carga la lista del módulo visible.
  const enProcesos = activeTab === "processes";
  const [processes, levelingProcesses, sites] = await Promise.all([
    enProcesos ? getPolygonalProcesses(supabase, project.id) : Promise.resolve([]),
    enProcesos ? getLevelingProcesses(supabase, project.id) : Promise.resolve([]),
    enProcesos ? getSites(supabase, project.id) : Promise.resolve([]),
  ]);
  const referencePoints = activeTab === "config" ? await getReferencePoints(supabase, project.id) : [];

  const tiposDelModulo = {
    poligonales: POLYGONAL_TYPE_OPTIONS,
    nivelaciones: LEVELING_TYPE_OPTIONS,
    asentamientos: SITE_TYPE_OPTIONS,
  }[modulo];
  const chips =
    modulo === "asentamientos" ? SITE_CHIPS : modulo === "poligonales" ? POLYGONAL_CHIPS : LEVELING_CHIPS;

  const filters: ProcessFilters = {
    q: typeof sp.q === "string" ? sp.q : "",
    estado: chips.includes(sp.estado as StatusFilter) ? (sp.estado as StatusFilter) : "todos",
    tipo: tiposDelModulo.some((t) => t.value === sp.tipo) ? (sp.tipo as string) : "todos",
    orden: SORT_KEYS.includes(sp.orden as SortKey) ? (sp.orden as SortKey) : "actividad",
    dir: sp.dir === "asc" ? "asc" : "desc",
  };

  // Filas del módulo visible, ya filtradas y ordenadas. El conteo de visitas y
  // la peor alerta de cada lugar se resuelven con dos consultas fijas para
  // todo el proyecto (`getSiteSummariesByProject`), no una tanda por lugar.
  let total = 0;
  let counts: StatusCounts = countByStatus([]);
  let rows: ProcessRow[] = [];
  if (enProcesos && modulo === "poligonales") {
    total = processes.length;
    counts = countByStatus(processes);
    rows = filterProcesses(processes, filters).map((p) => polygonalRow(project.id, p));
  } else if (enProcesos && modulo === "nivelaciones") {
    total = levelingProcesses.length;
    counts = countByStatus(levelingProcesses);
    rows = filterProcesses(levelingProcesses, filters, levelingMetric).map((p) =>
      levelingRow(project.id, p),
    );
  } else if (enProcesos) {
    const summaries = await getSiteSummariesByProject(supabase, project.id);
    const items = sites.map((site) =>
      siteItem(
        site,
        summaries[site.id]?.visitCount ?? 0,
        summaries[site.id]?.worstAlert ?? ("normal" as AlertLevel),
      ),
    );
    total = items.length;
    counts = countByStatus(items);
    rows = filterProcesses(items, filters, siteMetric).map((s) => siteRow(project.id, s));
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera compacta (Fase 22): la descripción y el resto de los datos
          del proyecto están en Configuración. */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: project.name }]}
        title={project.name}
        badge={
          <Badge tone={project.status === "active" ? "success" : "neutral"}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        }
        subtitle={[
          project.client,
          project.location,
          [project.datum, project.projection].filter(Boolean).join(" · "),
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={<NewProcessSelector projectId={project.id} />}
      />
      <Tabs
        items={TABS}
        activeId={activeTab}
        basePath={`/projects/${project.id}`}
        searchParams={sp}
      />

      {activeTab === "processes" && (
        <div className="flex flex-col gap-5">
          <nav className="flex flex-wrap gap-1.5" role="group" aria-label="Módulo">
            {SUBTABS.map((st) => {
              const active = st.key === modulo;
              const count =
                st.key === "poligonales"
                  ? processes.length
                  : st.key === "nivelaciones"
                    ? levelingProcesses.length
                    : sites.length;
              return (
                <Link
                  key={st.key}
                  href={subtabHref(project.id, st.key)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-mira bg-mira text-on-mira"
                      : "border-rule bg-card text-ink-2 hover:text-ink",
                  )}
                >
                  {st.label} <span className="tabular-nums">({count})</span>
                </Link>
              );
            })}
          </nav>

          {total === 0 ? (
            <EmptyState
              title={EMPTY[modulo].title}
              description={EMPTY[modulo].description}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <ProcessListToolbar
                key={modulo}
                projectId={project.id}
                modulo={modulo}
                filters={filters}
                counts={counts}
                chips={chips}
                typeOptions={tiposDelModulo}
                typeLabel={TYPE_LABEL[modulo]}
              />
              {rows.length === 0 ? (
                <EmptyState
                  title="Ninguno coincide"
                  description="Ajusta la búsqueda o los filtros para ver otros."
                />
              ) : (
                <ProcessTable
                  projectId={project.id}
                  modulo={modulo}
                  rows={rows}
                  filters={filters}
                  resultLabel={RESULT_LABEL[modulo]}
                />
              )}
            </div>
          )}
        </div>
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
