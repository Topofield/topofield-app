import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs, buttonClasses } from "@/components/design-system";
import { PointsCatalog } from "@/components/settlement/points-catalog";
import { SiteForm } from "@/components/settlement/site-form";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getSite,
  getSitePoints,
  getVisits,
} from "@/lib/supabase/queries";

interface SitePageProps {
  params: Promise<{ id: string; siteId: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { id, siteId } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) {
    notFound();
  }

  const points = await getSitePoints(supabase, site.id);
  // El diálogo de cierre resume cuántas visitas se van a congelar (§ 4.6):
  // cerrar el lugar cierra TODAS sus visitas de una vez.
  const visits = await getVisits(supabase, site.id);
  const visitsOpen = visits.filter((v) => v.status !== "closed").length;
  const disabled = site.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name },
        ]}
      />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{site.name}</h1>
        <Link
          href={`/projects/${project.id}/settlement/${site.id}`}
          className={buttonClasses({ variant: "secondary" })}
        >
          Ver análisis y visitas
        </Link>
      </div>
      <SiteForm
        projectId={project.id}
        site={site}
        pointsCount={points.length}
        visitsTotal={visits.length}
        visitsOpen={visitsOpen}
      />
      <PointsCatalog siteId={site.id} points={points} disabled={disabled} />
    </div>
  );
}
