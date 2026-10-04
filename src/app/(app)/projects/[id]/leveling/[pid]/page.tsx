import { notFound } from "next/navigation";
import { Badge } from "@/components/design-system";
import { LevelingEditor } from "@/components/leveling/leveling-editor";
import { ProcessReport } from "@/components/process/process-report";
import { processReportState } from "@/lib/reports/state";
import { reportsIncluding } from "@/lib/reports/including";
import { ProcessShell } from "@/components/process/process-shell";
import { ReopenDialog } from "@/components/process/reopen-dialog";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { createClient } from "@/lib/supabase/server";
import {
  getLevelingProcess,
  getLevelingReadings,
  getProjectById,
  getReferencePoints,
  getReports,
} from "@/lib/supabase/queries";
import { levelingKindLabel, type LevelingType } from "@/types/leveling";
import { PROCESS_STATUS_LABELS } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { reopenLevelingProcessAction } from "./actions";

interface LevelingPageProps {
  params: Promise<{ id: string; pid: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: "proceso", label: "Proceso" },
  { id: "informe", label: "Informe" },
];

/**
 * Pantalla de una nivelación (Fase 22): pestaña Proceso —libreta, perfil y
 * cierre, en vivo— y pestaña Informe.
 */
export default async function LevelingPage({ params, searchParams }: LevelingPageProps) {
  const { id, pid } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "informe" ? "informe" : "proceso";

  const supabase = await createClient();
  const process = await getLevelingProcess(supabase, pid);
  if (!process || process.project_id !== id) {
    notFound();
  }

  const [readings, project, points] = await Promise.all([
    getLevelingReadings(supabase, pid),
    getProjectById(supabase, id),
    getReferencePoints(supabase, id),
  ]);
  if (!project) {
    notFound();
  }

  const basePath = `/projects/${id}/leveling/${pid}`;

  // Reabrir (Fase 34): solo lo cerrado, con los informes que lo incluyen.
  const closed = process.status === "closed" || process.status === "rejected";
  const reportTitles = closed
    ? reportsIncluding(await getReports(supabase, id), "leveling", process.id).map((r) => r.title)
    : [];

  return (
    <ProcessShell
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: project.name, href: `/projects/${id}?tab=processes&modulo=nivelaciones` },
        { label: process.name },
      ]}
      title={process.name}
      badge={
        <Badge tone={PROCESS_STATUS_TONE[process.status]}>
          {PROCESS_STATUS_LABELS[process.status]}
        </Badge>
      }
      subtitle={`${levelingKindLabel(process.type as LevelingType, process.has_return_run)} · ${PRECISION_ORDER_LABELS[process.precision_order]}`}
      basePath={basePath}
      tabs={TABS}
      activeTab={activeTab}
      reportTab="informe"
      exportHref={`${basePath}/export`}
      actions={
        closed && (
          <ReopenDialog
            target="process"
            action={reopenLevelingProcessAction.bind(null, process.id)}
            reportTitles={reportTitles}
          />
        )
      }
    >
      {activeTab === "proceso" ? (
        <LevelingEditor process={process} readings={readings} points={points} />
      ) : (
        <ProcessReport
          project={project}
          process={{ type: "leveling", id: process.id, name: process.name }}
          state={processReportState(process.status)}
          notes={process.notes}
        />
      )}
    </ProcessShell>
  );
}
