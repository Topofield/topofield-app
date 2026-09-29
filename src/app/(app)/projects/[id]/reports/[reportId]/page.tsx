import { redirect } from "next/navigation";

interface ReportPageProps {
  params: Promise<{ id: string; reportId: string }>;
}

/**
 * La página intermedia del informe (índice y «Ver e imprimir») se retiró en la
 * Fase 22: era un paso de más. Los enlaces antiguos llevan a la vista
 * imprimible, que tiene migas y acciones propias.
 */
export default async function ReportPage({ params }: ReportPageProps) {
  const { id, reportId } = await params;
  redirect(`/projects/${id}/reports/${reportId}/print`);
}
