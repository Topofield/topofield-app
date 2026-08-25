import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/design-system";
import { SiteForm } from "@/components/settlement/site-form";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/supabase/queries";

interface NewSitePageProps {
  params: Promise<{ id: string }>;
}

export default async function NewSitePage({ params }: NewSitePageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: "Nuevo lugar" },
        ]}
      />
      <SiteForm projectId={project.id} />
    </div>
  );
}
