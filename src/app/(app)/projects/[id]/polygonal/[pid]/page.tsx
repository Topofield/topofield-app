import { notFound } from "next/navigation";
import { Badge } from "@/components/design-system";
import { PolygonalEditor } from "@/components/polygonal/polygonal-editor";
import { ProcessReport } from "@/components/process/process-report";
import { processReportState } from "@/lib/reports/state";
import { ProcessShell } from "@/components/process/process-shell";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { createClient } from "@/lib/supabase/server";
import {
  getPolygonalProcess,
  getPolygonalStations,
  getProjectById,
  getReferencePoints,
} from "@/lib/supabase/queries";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { POLYGONAL_TYPE_LABELS, PROCESS_STATUS_LABELS } from "@/types/polygonal";

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
    >
      {activeTab === "proceso" ? (
        <PolygonalEditor
          // Georreferenciar (Fase 15) reescribe el arranque en la base; el
          // editor guarda la configuración en estado propio, así que se
          // remonta para no volver a guardar después las coordenadas locales.
          key={process.georef_at ?? "local"}
          process={process}
          stations={stations}
          referencePoints={referencePoints}
          // `NaN` y no `0` cuando el proceso no declaró precisión angular: la
          // columna es nullable y `Number(null)` es 0, no NaN, de modo que la
          // tolerancia de dispersión salía 0" y avisaba en toda estación con
          // dos lecturas distintas. `validateReadings` salta el control si no
          // es finito.
          angularPrecisionSeconds={
            process.angular_precision_seconds == null
              ? Number.NaN
              : Number(process.angular_precision_seconds)
          }
        />
      ) : (
        <ProcessReport
          project={project}
          process={{ type: "polygonal", id: process.id, name: process.name }}
          state={processReportState(process.status)}
          notes={process.notes}
        />
      )}
    </ProcessShell>
  );
}
