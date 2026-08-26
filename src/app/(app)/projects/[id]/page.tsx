import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumbs,
  buttonClasses,
  EmptyState,
  Tabs,
  type SearchParams,
  type TabItem,
} from "@/components/design-system";
import { NewProcessSelector } from "@/components/projects/new-process-selector";
import { ProcessCard } from "@/components/projects/process-card";
import { ProcessListToolbar } from "@/components/projects/process-list-toolbar";
import { ProcessTable } from "@/components/projects/process-table";
import { ProjectConfigTab } from "@/components/projects/project-config-tab";
import { ProjectHeader } from "@/components/projects/project-header";
import { SiteCard } from "@/components/projects/site-card";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import {
  countByStatus,
  filterProcesses,
  type ProcessFilters,
  type SortKey,
  type StatusFilter,
} from "@/lib/process-list";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcesses,
  getPolygonalProcesses,
  getProjectById,
  getReferencePoints,
  getReports,
  getSiteSummariesByProject,
  getSites,
} from "@/lib/supabase/queries";
import { POLYGONAL_TYPES, type PolygonalType } from "@/types/polygonal";
import type { LevelingProcess } from "@/types/leveling";
import type { AlertLevel } from "@/types/settlement";
import type { Site } from "@/types/site";

const TABS: TabItem[] = [
  { id: "processes", label: "Procesos" },
  { id: "reports", label: "Informes" },
  { id: "config", label: "Configuración" },
];

type Modulo = "poligonales" | "nivelaciones" | "asentamientos";

const SUBTABS: { key: Modulo; label: string }[] = [
  { key: "poligonales", label: "Poligonales" },
  { key: "nivelaciones", label: "Nivelaciones" },
  { key: "asentamientos", label: "Control de Asentamientos" },
];

/** Destino de una sub-tab, conservando el resto de parámetros de la URL. */
function subtabHref(
  projectId: string,
  modulo: Modulo,
  sp: SearchParams,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === "tab" || key === "modulo" || value == null) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== "") params.append(key, v);
    }
  }
  params.set("tab", "processes");
  params.set("modulo", modulo);
  return `/projects/${projectId}?${params.toString()}`;
}

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
  const modulo: Modulo =
    sp.modulo === "nivelaciones" || sp.modulo === "asentamientos"
      ? sp.modulo
      : "poligonales";

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const processes =
    activeTab === "processes"
      ? await getPolygonalProcesses(supabase, project.id)
      : [];
  const levelingProcesses: LevelingProcess[] =
    activeTab === "processes"
      ? await getLevelingProcesses(supabase, project.id)
      : [];
  const sites: Site[] =
    activeTab === "processes" ? await getSites(supabase, project.id) : [];
  const referencePoints =
    activeTab === "config"
      ? await getReferencePoints(supabase, project.id)
      : [];
  const reports =
    activeTab === "reports" ? await getReports(supabase, project.id) : [];

  // El conteo de visitas y la peor alerta solo se necesitan para pintar la
  // sub-tab de asentamientos, y se resuelven con dos consultas fijas para
  // todo el proyecto (`getSiteSummariesByProject`), no una tanda de tres por
  // lugar: con N lugares, ir lugar a lugar serían 3N viajes a la base.
  const siteRows =
    activeTab === "processes" && modulo === "asentamientos"
      ? await (async () => {
          const summaries = await getSiteSummariesByProject(supabase, project.id);
          return sites.map((site) => {
            const summary = summaries[site.id];
            return {
              site,
              visitCount: summary?.visitCount ?? 0,
              worstAlert: summary?.worstAlert ?? ("normal" as AlertLevel),
            };
          });
        })()
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

          <nav
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filtrar por módulo"
          >
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
                  href={subtabHref(project.id, st.key, sp)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    active
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-neutral-200 bg-white text-neutral-500 hover:text-neutral-800",
                  )}
                >
                  {st.label} <span className="tabular-nums">({count})</span>
                </Link>
              );
            })}
          </nav>

          {modulo === "poligonales" &&
            (processes.length === 0 ? (
              <EmptyState
                title="Aún no hay poligonales"
                description="Crea la primera poligonal del proyecto con «+ Nuevo Proceso»."
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
            ))}

          {modulo === "nivelaciones" &&
            (levelingProcesses.length === 0 ? (
              <EmptyState
                title="Aún no hay nivelaciones"
                description="Crea la primera nivelación del proyecto con «+ Nuevo Proceso»."
              />
            ) : (
              <LevelingProcessSection
                projectId={project.id}
                processes={levelingProcesses}
              />
            ))}

          {modulo === "asentamientos" &&
            (siteRows.length === 0 ? (
              <EmptyState
                title="Aún no hay lugares"
                description="Crea el primer lugar de control de asentamientos con «+ Nuevo Proceso»."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {siteRows.map((row) => (
                  <SiteCard
                    key={row.site.id}
                    projectId={project.id}
                    site={row.site}
                    visitCount={row.visitCount}
                    worstAlert={row.worstAlert}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Link
              href={`/projects/${project.id}/reports/new`}
              className={buttonClasses({ variant: "primary" })}
            >
              Generar Nuevo Informe
            </Link>
          </div>
          {reports.length === 0 ? (
            <EmptyState
              title="Aún no hay informes"
              description="Un informe reúne procesos ya cerrados de este proyecto y produce un documento imprimible con su registro de trazabilidad."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/projects/${project.id}/reports/${r.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-4 py-3 transition-colors hover:bg-neutral-50"
                  >
                    <span className="font-medium">{r.title}</span>
                    <span className="text-sm text-neutral-500">
                      {r.included_processes.length}{" "}
                      {r.included_processes.length === 1
                        ? "proceso"
                        : "procesos"}
                      {r.generated_at ? ` · ${formatDate(r.generated_at)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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

/**
 * Procesos de nivelación del proyecto, agrupados en «En progreso» y
 * «Cerrados». A diferencia de la poligonal (Fase 3), esta sección no tiene
 * todavía buscador ni filtros propios: se resuelve cuando la cantidad de
 * procesos de nivelación lo justifique.
 */
function LevelingProcessSection({
  projectId,
  processes,
}: {
  projectId: string;
  processes: LevelingProcess[];
}) {
  const enProgreso = processes.filter(
    (p) => p.status !== "closed" && p.status !== "rejected",
  );
  const cerrados = processes.filter(
    (p) => p.status === "closed" || p.status === "rejected",
  );

  return (
    <div className="flex flex-col gap-4">
      {enProgreso.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-neutral-500">
            En progreso
          </h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enProgreso.map((p) => (
              <ProcessCard
                key={p.id}
                projectId={projectId}
                process={p}
                kind="leveling"
              />
            ))}
          </div>
        </div>
      )}
      {cerrados.length > 0 && (
        <div className="flex flex-col gap-3">
          <h4 className="text-xs font-medium text-neutral-500">Cerrados</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cerrados.map((p) => (
              <ProcessCard
                key={p.id}
                projectId={projectId}
                process={p}
                kind="leveling"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
