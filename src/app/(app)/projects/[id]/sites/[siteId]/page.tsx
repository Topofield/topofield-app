import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/design-system";
import { PointsCatalog } from "@/components/settlement/points-catalog";
import { SiteForm } from "@/components/settlement/site-form";
import { createClient } from "@/lib/supabase/server";
import { getProjectById, getSite, getSitePoints } from "@/lib/supabase/queries";

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
      <SiteForm projectId={project.id} site={site} />
      <PointsCatalog siteId={site.id} points={points} disabled={disabled} />
    </div>
  );
}
