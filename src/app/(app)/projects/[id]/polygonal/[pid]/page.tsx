import { notFound } from "next/navigation";
import { Badge } from "@/components/design-system";
import { PolygonalEditor } from "@/components/polygonal/polygonal-editor";
import { ProcessReport } from "@/components/process/process-report";
import { processReportState } from "@/lib/reports/state";
import { reportsIncluding } from "@/lib/reports/including";
import { ProcessShell } from "@/components/process/process-shell";
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
  getReports,
} from "@/lib/supabase/queries";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { POLYGONAL_TYPE_LABELS, PROCESS_STATUS_LABELS } from "@/types/polygonal";
import { reopenPolygonalProcessAction } from "./actions";

interface PolygonalPageProps {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "proceso", label: "Proceso" },
  { id: "informe", label: "Informe" },
];

/**
 * Pantalla de una poligonal (Fase 22): pestaña Proceso —captura, cálculo,
 * dibujo y ajuste, en vivo— y pestaña Informe.
 */
export default async function PolygonalPage({ params, searchParams }: PolygonalPageProps) {
  const { id, pid } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "informe" ? "informe" : "proceso";

  const supabase = await createClient();
  const process = await getPolygonalProcess(supabase, pid);
  if (!process || process.project_id !== id) {
    notFound();
  }

  const [stations, project, referencePoints] = await Promise.all([
    getPolygonalStations(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
  ]);
  if (!project) {
    notFound();
  }

  const basePath = `/projects/${id}/polygonal/${pid}`;

  // Reabrir (Fase 34): solo lo cerrado, con los informes que lo incluyen. Los
  // informes se piden una vez: también los usa la pestaña Informe.
  const state = processReportState(process.status);
  const closed = state !== "draft";
  const reports =
    closed || activeTab === "informe" ? await getReports(supabase, id) : [];
  const reportTitles = reportsIncluding(reports, "polygonal", process.id).map((r) => r.title);

  return (
    <ProcessShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: project.name, href: `/projects/${id}?tab=processes&modulo=poligonales` },
        { label: process.name },
      ]}
      title={process.name}
      badge={
        <Badge tone={PROCESS_STATUS_TONE[process.status]}>
          {PROCESS_STATUS_LABELS[process.status]}
        </Badge>
      }
      subtitle={`Poligonal ${POLYGONAL_TYPE_LABELS[process.type].toLowerCase()} · ${PRECISION_ORDER_LABELS[process.precision_order]}`}
      basePath={basePath}
      tabs={TABS}
      activeTab={activeTab}
      reportTab="informe"
      exportHref={`${basePath}/export`}
      actions={
        closed && (
          <ReopenDialog
            target="process"
            action={reopenPolygonalProcessAction.bind(null, process.id)}
            reportTitles={reportTitles}
          />
        )
      }
    >
      {activeTab === "proceso" ? (
        <PolygonalEditor
          // Georreferenciar (Fase 15) reescribe el arranque en la base; el
          // editor guarda la configuración en estado propio, así que se
          // remonta para no volver a guardar después las coordenadas locales.
          // También al cerrar o reabrir (Fase 34): lo que se tocó en solo
          // lectura, como el formato de ángulo, no pasa al proceso abierto.
          key={`${process.georef_at ?? "local"}:${state}`}
          process={process}
          stations={stations}
          referencePoints={referencePoints}
        />
      ) : (
        <ProcessReport
          project={project}
          process={{ type: "polygonal", id: process.id, name: process.name }}
          state={state}
          reports={reports}
          notes={process.notes}
        />
      )}
    </ProcessShell>
  );
}
