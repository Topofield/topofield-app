import { notFound } from "next/navigation";
import { PageHeader } from "@/components/design-system";
import { ReportForm } from "@/components/reports/report-form";
import { createClient } from "@/lib/supabase/server";
import {
  getClosedWorkForReports,
  getProjectById,
} from "@/lib/supabase/queries";
import { selectableProcesses } from "@/lib/reports/eligibility";

interface NewReportPageProps {
  params: Promise<{ id: string }>;
  /** `incluir=tipo:id`, una o varias veces: procesos que llegan marcados. */
  searchParams: Promise<{ incluir?: string | string[] }>;
}

export default async function NewReportPage({ params, searchParams }: NewReportPageProps) {
  const { id } = await params;
  const { incluir } = await searchParams;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  // La consulta ya filtra por `status = 'closed'`; se pasa igualmente por la
  // función pura, que es la que define la regla y la que tiene los tests.
  const candidates = selectableProcesses(
    await getClosedWorkForReports(supabase, project.id),
  );
  const initialSelected = incluir === undefined ? [] : [incluir].flat();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}?tab=reports` },
          { label: "Nuevo informe" },
        ]}
        title="Nuevo informe"
        subtitle="Reúne poligonales y nivelaciones calculadas y controles de asentamientos cerrados del proyecto en un solo documento."
      />
      <ReportForm
        projectId={project.id}
        candidates={candidates}
        initialSelected={initialSelected}
      />
    </div>
  );
}
