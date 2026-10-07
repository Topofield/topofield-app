import { notFound } from "next/navigation";
import { Tabs } from "@/components/design-system";
import { ProcessReport } from "@/components/process/process-report";
import { NewVisitDialog } from "@/components/settlement/new-visit-dialog";
import { SiteHeader } from "@/components/settlement/site-header";
import { isPointActiveOn, pointInputOf } from "@/lib/calculations/settlement";
import { reportsIncluding } from "@/lib/reports/including";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getReferencePoints,
  getReports,
  getSettlementReadingsBySite,
  getSite,
  getSiteBenchmarks,
  getSiteBooks,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { formatDateOnly } from "@/lib/utils/format";
import { BenchmarksTab } from "./benchmarks-tab";
import { PanelTab } from "./panel-tab";
import { PlaceTab } from "./place-tab";

interface SettlementPageProps {
  params: Promise<{ id: string; siteId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "panel", label: "Panel" },
  { id: "puntos", label: "Puntos" },
  { id: "bms", label: "BMs" },
  { id: "informe", label: "Informe" },
];

/**
 * Pantalla de un lugar de asentamientos (Fase 37, lienzo «Lugar B»): la
 * cabecera común, con «+ Nueva visita», y las pestañas Panel —visitas y
 * tendencia lado a lado—, Puntos, BMs e Informe. Sin estado: el lugar no se
 * cierra.
 */
export default async function SettlementPage({ params, searchParams }: SettlementPageProps) {
  const { id, siteId } = await params;
  const { tab } = await searchParams;
  // «lugar» era la pestaña Puntos y lugar hasta la Fase 37.
  const activeTab =
    tab === "puntos" || tab === "lugar" ? "puntos" : tab === "bms" || tab === "informe" ? tab : "panel";

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) notFound();
  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id || site.kind !== "settlement") notFound();

  const [sitePoints, visits, benchmarks, referencePoints, reports] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSiteBenchmarks(supabase, site.id),
    getReferencePoints(supabase, project.id),
    getReports(supabase, project.id),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const activos = sitePoints.map(pointInputOf).filter((p) => isPointActiveOn(p, hoy)).length;
  const base = visits[0]?.date;
  const basePath = `/projects/${project.id}/settlement/${site.id}`;
  const summary =
    `${activos} ${activos === 1 ? "punto" : "puntos"} de control · ` +
    `${benchmarks.length} BM` +
    (base ? ` · base el ${formatDateOnly(base)}` : "");

  return (
    <div className="flex flex-col gap-6">
      <SiteHeader
        projectId={project.id}
        projectName={project.name}
        site={site}
        summary={summary}
        reportTitles={reportsIncluding(reports, "site", site.id).map((r) => r.title)}
        printable={activeTab === "informe"}
        newVisit={
          // Tarea 11: el popup de la nueva visita (Fase 37).
          <NewVisitDialog
            projectId={project.id}
            siteId={site.id}
            referencePoints={referencePoints}
            previous={visits.at(-1) ?? null}
          />
        }
      />
      <div className="print:hidden">
        <Tabs items={TABS} activeId={activeTab} basePath={basePath} />
      </div>
      {activeTab === "panel" && (
        <PanelTab
          project={project}
          site={site}
          sitePoints={sitePoints}
          visits={visits}
          readingsBySite={await getSettlementReadingsBySite(supabase, site.id)}
          booksByVisit={await getSiteBooks(supabase, site.id)}
          benchmarks={benchmarks}
        />
      )}
      {activeTab === "puntos" && <PlaceTab site={site} points={sitePoints} hasVisits={visits.length > 0} />}
      {activeTab === "bms" && (
        <BenchmarksTab
          supabase={supabase}
          projectId={project.id}
          siteId={site.id}
          benchmarks={benchmarks}
          booksByVisit={await getSiteBooks(supabase, site.id)}
        />
      )}
      {activeTab === "informe" && (
        <ProcessReport
          project={project}
          process={{ type: "site", id: site.id, name: site.name }}
          state="draft"
          includable={visits.some((v) => v.status === "calculated")}
          reports={reports}
          notes={site.description}
        />
      )}
    </div>
  );
}
