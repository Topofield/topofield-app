"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/design-system";
import { ProcessHeader } from "@/components/process/process-header";
import { deleteSiteAction, duplicateSiteAction } from "@/app/(app)/projects/[id]/sites/actions";
import { STRUCTURE_TYPE_LABELS, type Site } from "@/types/site";
import { SiteDialog } from "./site-dialog";

/**
 * La cabecera del lugar (Fase 37): la de la poligonal y la nivelación, con
 * «+ Nueva visita» como primera acción y «Editar datos» en el popup del alta.
 * Sin estado: el lugar no se cierra.
 */
export function SiteHeader({
  projectId,
  projectName,
  site,
  summary,
  printable,
  newVisit,
}: {
  projectId: string;
  projectName: string;
  site: Site;
  /** «16 puntos de control · 1 BM · base el 24 de marzo de 2022». */
  summary: string;
  printable: boolean;
  newVisit: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <ProcessHeader
      projectName={projectName}
      hubHref={`/projects/${projectId}?tab=processes&modulo=asentamientos`}
      title={site.name}
      badges={<Badge tone="neutral">Control de asentamientos · {STRUCTURE_TYPE_LABELS[site.structure_type]}</Badge>}
      location={summary}
      responsible=""
      equipment={null}
      updatedAt={site.updated_at}
      exportHref={`/projects/${projectId}/settlement/${site.id}/export`}
      printable={printable}
      primaryAction={newVisit}
      onEdit={() => setEditing(true)}
      duplicate={() => duplicateSiteAction(site.id)}
      remove={() => deleteSiteAction(site.id)}
      subject="el lugar"
      deleteTitle="Eliminar lugar"
      deleteWhat="con sus puntos, sus BM y sus visitas"
    >
      {editing && (
        <SiteDialog mode="edit" projectId={projectId} site={site} open={editing} onClose={() => setEditing(false)} />
      )}
    </ProcessHeader>
  );
}
