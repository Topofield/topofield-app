import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/design-system";
import { VisitEditor } from "@/components/settlement/visit-editor";
import { thresholdsOf } from "@/lib/calculations/tolerances";
import { loadVisitData } from "../visit-data";

interface VisitEditPageProps {
  params: Promise<{ id: string; siteId: string; visitId: string }>;
  searchParams: Promise<{ importar?: string }>;
}

/**
 * Editor de la visita (Fase 18, decisión 14): captura de la libreta o de las
 * cotas. Solo para visitas abiertas de un lugar abierto: una cerrada se lee en
 * su vista.
 */
export default async function VisitEditPage({
  params,
  searchParams,
}: VisitEditPageProps) {
  const { id, siteId, visitId } = await params;
  const { importar } = await searchParams;
  const data = await loadVisitData(id, siteId, visitId);
  const { project, site, visit } = data;

  const viewHref = `/projects/${project.id}/settlement/${site.id}/visits/${visit.id}`;
  if (site.status === "closed" || visit.status === "closed") redirect(viewHref);

  const visitLabel =
    visit.visit_number === 0 ? "Visita 0 — Línea base" : `Visita ${visit.visit_number}`;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name, href: `/projects/${project.id}/settlement/${site.id}` },
          { label: visitLabel, href: viewHref },
          { label: "Editar" },
        ]}
      />
      <VisitEditor
        projectId={project.id}
        siteId={site.id}
        visit={visit}
        initialElevations={data.initialElevations}
        initialBook={data.initialBook}
        previousBook={data.previousBook}
        referencePoints={data.referencePoints}
        points={data.points}
        otherVisits={data.otherVisits}
        otherVisitOrders={data.otherVisitOrders}
        thresholds={thresholdsOf(site)}
        disabled={false}
        siteClosed={false}
        viewHref={viewHref}
        openImport={importar === "1"}
      />
    </div>
  );
}
