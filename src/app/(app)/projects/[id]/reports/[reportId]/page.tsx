import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, buttonClasses, Card } from "@/components/design-system";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getReport } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils/format";
import { CANDIDATE_KIND_LABELS } from "@/types/report";

interface ReportPageProps {
  params: Promise<{ id: string; reportId: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id, reportId } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) notFound();

  const report = await getReport(supabase, reportId);
  if (!report || report.project_id !== project.id) notFound();

  const entries = [...report.included_processes].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}?tab=reports` },
          { label: report.title },
        ]}
      />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{report.title}</h1>
        <Link
          href={`/projects/${project.id}/reports/${report.id}/print`}
          className={buttonClasses({ variant: "primary" })}
        >
          Ver e imprimir
        </Link>
      </div>

      <Card title="Contenido del informe">
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="text-neutral-500">Emitido</dt>
          <dd>
            {report.generated_at ? formatDate(report.generated_at) : "—"}
          </dd>
          <dt className="text-neutral-500">Procesos incluidos</dt>
          <dd>{entries.length}</dd>
        </dl>

        <ol className="mt-4 flex flex-col gap-1 text-sm">
          {entries.map((e) => (
            <li
              key={`${e.type}:${e.id}`}
              className="flex gap-3 border-b border-neutral-100 py-1.5 last:border-0"
            >
              <span className="w-48 shrink-0 text-neutral-500">
                {CANDIDATE_KIND_LABELS[e.type]}
              </span>
              <span>{e.name}</span>
            </li>
          ))}
        </ol>

        {report.observations && (
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-800">
              Observaciones
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">
              {report.observations}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
