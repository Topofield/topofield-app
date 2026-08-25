import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/design-system";
import { VisitEditor } from "@/components/settlement/visit-editor";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectById,
  getSettlementReadingsBySite,
  getSite,
  getSitePoints,
  getVisit,
  getVisits,
} from "@/lib/supabase/queries";
import type { Thresholds, VisitInput } from "@/types/settlement";

interface VisitEditorPageProps {
  params: Promise<{ id: string; siteId: string; visitId: string }>;
}

/** Umbrales del lugar, desnormalizados para el motor de cálculo. */
function thresholdsOf(site: {
  velocity_caution: number;
  velocity_alert: number;
  velocity_alarm: number;
  accumulated_caution: number;
  accumulated_alert: number;
  accumulated_alarm: number;
  angular_distortion_limit: number;
}): Thresholds {
  return {
    velocityCaution: Number(site.velocity_caution),
    velocityAlert: Number(site.velocity_alert),
    velocityAlarm: Number(site.velocity_alarm),
    accumulatedCaution: Number(site.accumulated_caution),
    accumulatedAlert: Number(site.accumulated_alert),
    accumulatedAlarm: Number(site.accumulated_alarm),
    angularDistortionLimit: site.angular_distortion_limit,
  };
}

export default async function VisitEditorPage({
  params,
}: VisitEditorPageProps) {
  const { id, siteId, visitId } = await params;

  const supabase = await createClient();

  const project = await getProjectById(supabase, id);
  if (!project) {
    notFound();
  }

  const site = await getSite(supabase, siteId);
  if (!site || site.project_id !== project.id) {
    notFound();
  }

  const visitWithReadings = await getVisit(supabase, visitId);
  if (!visitWithReadings || visitWithReadings.visit.site_id !== site.id) {
    notFound();
  }
  const { visit, readings } = visitWithReadings;

  const [points, allVisits, readingsBySite] = await Promise.all([
    getSitePoints(supabase, site.id),
    getVisits(supabase, site.id),
    getSettlementReadingsBySite(supabase, site.id),
  ]);

  const initialElevations: Record<string, number> = {};
  for (const reading of readings) {
    initialElevations[reading.point_id] = Number(reading.elevation);
  }

  // El resto del histórico (con sus lecturas) para que el cálculo en vivo del
  // cliente tenga el mismo contexto que usará el servidor al guardar. Se
  // arma con una sola consulta (`getSettlementReadingsBySite`, con join) en
  // vez de una por visita, que multiplicaría los viajes a la base.
  const otherVisits: VisitInput[] = allVisits
    .filter((v) => v.id !== visit.id)
    .map((v) => ({
      id: v.id,
      visitNumber: v.visit_number,
      date: v.date,
      readings: (readingsBySite[v.id] ?? []).map((r) => ({
        pointId: r.point_id,
        elevation: Number(r.elevation),
      })),
    }));

  const disabled = site.status === "closed" || visit.status === "closed";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: site.name, href: `/projects/${project.id}/settlement/${site.id}` },
          {
            label:
              visit.visit_number === 0
                ? "Visita 0 — Línea base"
                : `Visita ${visit.visit_number}`,
          },
        ]}
      />
      <VisitEditor
        projectId={project.id}
        siteId={site.id}
        visit={visit}
        initialElevations={initialElevations}
        points={points}
        otherVisits={otherVisits}
        thresholds={thresholdsOf(site)}
        disabled={disabled}
        siteClosed={site.status === "closed"}
      />
    </div>
  );
}
