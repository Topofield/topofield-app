import { redirect } from "next/navigation";

interface SitePageProps {
  params: Promise<{ id: string; siteId: string }>;
}

/**
 * La configuración del lugar vive desde la Fase 22 en la pestaña «Puntos y
 * lugar» de su pantalla. Los enlaces antiguos llevan allí.
 */
export default async function SitePage({ params }: SitePageProps) {
  const { id, siteId } = await params;
  redirect(`/projects/${id}/settlement/${siteId}?tab=lugar`);
}
