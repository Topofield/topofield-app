import Link from "next/link";
import { buttonClasses, EmptyState, KpiCard } from "@/components/design-system";
import { DashboardFilter } from "@/components/projects/dashboard-filter";
import { ProjectCard } from "@/components/projects/project-card";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardKpis,
  getDashboardProjects,
  getProcessCountsByProject,
} from "@/lib/supabase/queries";
import type { ProjectStatus } from "@/types/project";

interface DashboardPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { status: statusParam } = await searchParams;
  const status: ProjectStatus =
    statusParam === "archived" ? "archived" : "active";

  const supabase = await createClient();
  const [kpis, projects, processCounts] = await Promise.all([
    getDashboardKpis(supabase),
    getDashboardProjects(supabase, status),
    getProcessCountsByProject(supabase),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/projects/new" className={buttonClasses()}>
          + Nuevo Proyecto
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Proyectos activos" value={kpis.activeProjects} />
        <KpiCard
          label="Procesos calculados"
          value={kpis.calculatedProcesses}
          hint="Listos para revisar y cerrar."
        />
        <KpiCard
          label="Fuera de tolerancia"
          value={kpis.outOfTolerance}
          hint="Requieren revisión antes del cierre."
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Proyectos</h2>
          <DashboardFilter activeStatus={status} />
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title={
              status === "active"
                ? "Aún no tienes proyectos"
                : "No hay proyectos archivados"
            }
            description={
              status === "active"
                ? "Crea tu primer proyecto para empezar a registrar procesos topográficos."
                : undefined
            }
            action={
              status === "active" ? (
                <Link href="/projects/new" className={buttonClasses()}>
                  + Nuevo Proyecto
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                processCount={processCounts[project.id] ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
