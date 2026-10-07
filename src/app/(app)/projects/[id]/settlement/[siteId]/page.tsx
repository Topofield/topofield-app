import { notFound } from "next/navigation";
import { Tabs } from "@/components/design-system";
import { ProcessReport } from "@/components/process/process-report";
import { visitArmadaSpans } from "@/components/settlement/visit-armadas";
import { NewVisitButton } from "@/components/settlement/visit-dialog";
import { templateNote } from "@/components/settlement/visit-dialog-form";
import { SiteHeader } from "@/components/settlement/site-header";
import { isPointActiveOn, pointInputOf } from "@/lib/calculations/settlement";
import { bookRowOf, bookTemplate } from "@/lib/calculations/settlement-book";
import { reportsIncluding } from "@/lib/reports/including";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getReports,
  getSettlementReadingsBySite,
  getSite,
  getSiteBenchmarks,
  getSiteBooks,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { formatDateOnly, todayInBogota } from "@/lib/utils/format";
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

  const [sitePoints, visits, benchmarks, booksByVisit, reports] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSiteBenchmarks(supabase, site.id),
    getSiteBooks(supabase, site.id),
    getReports(supabase, project.id),
  ]);

  const hoy = todayInBogota();
  const activos = sitePoints.map(pointInputOf).filter((p) => isPointActiveOn(p, hoy)).length;
  const base = visits[0]?.date;
  const basePath = `/projects/${project.id}/settlement/${site.id}`;
  const summary =
    `${activos} ${activos === 1 ? "punto" : "puntos"} de control · ` +
    `${benchmarks.length} BM` +
    (base ? ` · base el ${formatDateOnly(base)}` : "");

  // La nota del popup describe la libreta que traerá la visita nueva: la
  // misma plantilla que arma `createVisitAction`, con la fecha de hoy.
  const previous = visits.at(-1) ?? null;
  const previousBook = previous ? (booksByVisit[previous.id] ?? []).map((row) => bookRowOf(row)) : [];
  const template = bookTemplate(
    previousBook,
    sitePoints.map(pointInputOf),
    hoy,
    benchmarks,
  );
  const note = templateNote({
    previousNumber: previous && previousBook.length > 0 ? previous.visit_number : null,
    armadas: visitArmadaSpans(template).length,
    startCode: template[0]?.pointCode ?? null,
    points: template.filter((row) => row.pointType === "intermediate").length,
    firstBenchmark: benchmarks[0]?.code ?? null,
  });

  return (
    <div className="flex flex-col gap-6">
      <SiteHeader
        projectId={project.id}
        projectName={project.name}
        site={site}
        summary={summary}
        reportTitles={reportsIncluding(reports, "site", site.id).map((r) => r.title)}
        printable={activeTab === "informe"}
        newVisit={<NewVisitButton projectId={project.id} siteId={site.id} note={note} />}
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
          booksByVisit={booksByVisit}
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
          booksByVisit={booksByVisit}
        />
      )}
      {activeTab === "informe" && (
        <ProcessReport
          project={project}
          process={{ type: "site", id: site.id, name: site.name }}
          includable={visits.some((v) => v.status === "calculated")}
          reports={reports}
          notes={site.description}
        />
      )}
    </div>
  );
}
