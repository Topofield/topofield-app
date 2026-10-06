import { notFound } from "next/navigation";
import { Badge } from "@/components/design-system";
import { ProcessReport } from "@/components/process/process-report";
import { processReportState } from "@/lib/reports/state";
import { reportsIncluding } from "@/lib/reports/including";
import { ProcessShell } from "@/components/process/process-shell";
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { NewVisitDialog } from "@/components/settlement/new-visit-dialog";
import { isPointActiveOn, pointInputOf } from "@/lib/calculations/settlement";
import { SITE_STATUS_TONE } from "@/lib/process-status";
import { createClient } from "@/lib/supabase/server";
import {
  getPointIdsWithClosedReadings,
  getProjectById,
  getReferencePoints,
  getReports,
  getSettlementReadingsBySite,
  getSite,
  getSiteBooks,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { formatDateOnly } from "@/lib/utils/format";
import { SITE_STATUS_LABELS, STRUCTURE_TYPE_LABELS } from "@/types/site";
import { reopenSiteAction } from "@/app/(app)/projects/[id]/sites/actions";
import { PanelTab } from "./panel-tab";
import { PlaceTab } from "./place-tab";

interface SettlementPageProps {
  params: Promise<{ id: string; siteId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "panel", label: "Panel" },
  { id: "lugar", label: "Puntos y lugar" },
  { id: "informe", label: "Informe" },
];

/**
 * Pantalla de un control de asentamientos (Fase 22): pestañas Panel —KPIs,
 * visitas, gráficas y análisis—, Puntos y lugar —datos, umbrales y catálogo—
 * e Informe.
 */
export default async function SettlementPage({ params, searchParams }: SettlementPageProps) {
  const { id, siteId } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "lugar" || tab === "informe" ? tab : "panel";

  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id || site.kind !== "settlement") {
    notFound();
  }

  const [sitePoints, visits, referencePoints] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getReferencePoints(supabase, project.id),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const activos = sitePoints.map(pointInputOf).filter((p) => isPointActiveOn(p, hoy)).length;
  const base = visits[0]?.date;
  const basePath = `/projects/${project.id}/settlement/${site.id}`;

  // Reabrir el lugar (Fase 34), con los informes que lo incluyen.
  const reportTitles =
    site.status === "closed"
      ? reportsIncluding(await getReports(supabase, project.id), "site", site.id).map((r) => r.title)
      : [];

  return (
    <ProcessShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: project.name, href: `/projects/${project.id}?tab=processes&modulo=asentamientos` },
        { label: site.name },
      ]}
      title={site.name}
      badge={<Badge tone={SITE_STATUS_TONE[site.status]}>{SITE_STATUS_LABELS[site.status]}</Badge>}
      subtitle={
        `Control de asentamientos · ${STRUCTURE_TYPE_LABELS[site.structure_type]} · ` +
        `${activos} ${activos === 1 ? "punto" : "puntos"} de control` +
        (base ? ` · lectura base el ${formatDateOnly(base)}` : "")
      }
      basePath={basePath}
      tabs={TABS}
      activeTab={activeTab}
      reportTab="informe"
      exportHref={`${basePath}/export`}
      actions={
        site.status !== "closed" ? (
          <NewVisitDialog
            projectId={project.id}
            siteId={site.id}
            referencePoints={referencePoints}
            previous={visits.at(-1) ?? null}
          />
        ) : (
          <ReopenDialog
            target="site"
            action={reopenSiteAction.bind(null, site.id)}
            reportTitles={reportTitles}
          />
        )
      }
    >
      {activeTab === "panel" && (
        <PanelTab
          project={project}
          site={site}
          sitePoints={sitePoints}
          visits={visits}
          readingsBySite={await getSettlementReadingsBySite(supabase, site.id)}
          booksByVisit={await getSiteBooks(supabase, site.id)}
        />
      )}
      {activeTab === "lugar" && (
        <PlaceTab
          projectId={project.id}
          site={site}
          points={sitePoints}
          visits={visits}
          referenceLocked={await getPointIdsWithClosedReadings(supabase, site.id)}
        />
      )}
      {activeTab === "informe" && (
        <ProcessReport
          project={project}
          process={{ type: "site", id: site.id, name: site.name }}
          state={processReportState(site.status)}
          notes={site.notes}
        />
      )}
    </ProcessShell>
  );
}
