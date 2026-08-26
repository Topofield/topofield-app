import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, buttonClasses } from "@/components/design-system";
import { AnalysisPanel } from "@/components/settlement/analysis-panel";
import { VisitsList } from "@/components/settlement/visits-list";
import { createClient } from "@/lib/supabase/server";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  getProjectById,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import type { PointInput, VisitInput } from "@/types/settlement";

interface SettlementAnalysisPageProps {
  params: Promise<{ id: string; siteId: string }>;
}

/**
 * Panel de análisis de un lugar: lista de visitas, semáforo por punto y
 * asentamientos diferenciales. El histórico se calcula aquí, en el servidor,
 * con `computeHistory` — el mismo motor que usan las Server Actions al
 * guardar, para que lo que se ve coincida siempre con lo persistido.
 */
export default async function SettlementAnalysisPage({
  params,
}: SettlementAnalysisPageProps) {
  const { id, siteId } = await params;

  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) {
    notFound();
  }

  const [sitePoints, visits, readingsBySite] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
  ]);

  const points: PointInput[] = sitePoints.map((p) => ({
    id: p.id,
    code: p.code,
    northing: p.northing === null ? null : Number(p.northing),
    easting: p.easting === null ? null : Number(p.easting),
    initialElevation:
      p.initial_elevation === null ? null : Number(p.initial_elevation),
  }));

  const visitInputs: VisitInput[] = visits.map((v) => ({
    id: v.id,
    visitNumber: v.visit_number,
    date: v.date,
    readings: (readingsBySite[v.id] ?? []).map((r) => ({
      pointId: r.point_id,
      elevation: Number(r.elevation),
    })),
  }));

  const history = computeHistory(points, visitInputs, thresholdsOf(site));

  const visitRows = visits.map((visit) => ({
    visit,
    worstAlert:
      history.visits.find((v) => v.visitId === visit.id)?.worstAlert ??
      ("normal" as const),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name, href: `/projects/${project.id}/sites/${site.id}` },
          { label: "Análisis" },
        ]}
      />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{site.name}</h1>
        <div className="flex items-center gap-3">
          <a
            href={`/projects/${project.id}/settlement/${site.id}/export`}
            className={buttonClasses({ variant: "secondary" })}
            download
          >
            Exportar a Excel
          </a>
          <Link
            href={`/projects/${project.id}/sites/${site.id}`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Editar lugar
          </Link>
        </div>
      </div>
      <VisitsList
        projectId={project.id}
        siteId={site.id}
        rows={visitRows}
        disabled={site.status === "closed"}
      />
      <AnalysisPanel
        points={points}
        visits={history.visits}
        differentials={history.differentials}
        trends={history.trends}
      />
    </div>
  );
}
