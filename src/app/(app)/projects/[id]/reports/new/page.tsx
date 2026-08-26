import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/design-system";
import { ReportForm } from "@/components/reports/report-form";
import { createClient } from "@/lib/supabase/server";
import {
  getClosedWorkForReports,
  getProjectById,
} from "@/lib/supabase/queries";
import { selectableProcesses } from "@/lib/reports/eligibility";

interface NewReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewReportPage({ params }: NewReportPageProps) {
  const { id } = await params;

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

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}?tab=reports` },
          { label: "Nuevo informe" },
        ]}
      />
      <h1 className="text-xl font-semibold">Nuevo informe</h1>
      <ReportForm projectId={project.id} candidates={candidates} />
    </div>
  );
}
