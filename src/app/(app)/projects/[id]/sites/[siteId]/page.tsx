import { redirect } from "next/navigation";

interface SitePageProps {
  params: Promise<{ id: string; siteId: string }>;
}

/**
 * El catálogo de puntos vive en la pestaña «Puntos» de la pantalla del lugar
 * (Fase 22; los datos del lugar, desde la Fase 37, en «Editar datos»). Los
 * enlaces antiguos llevan allí.
 */
export default async function SitePage({ params }: SitePageProps) {
  const { id, siteId } = await params;
  redirect(`/projects/${id}/settlement/${siteId}?tab=puntos`);
}
