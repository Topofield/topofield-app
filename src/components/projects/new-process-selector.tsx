"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/design-system";
import { PolygonalDetailsDialog } from "@/components/polygonal/polygonal-details-dialog";
import { LevelingDetailsDialog } from "@/components/leveling/leveling-details-dialog";
import { SiteDialog } from "@/components/settlement/site-dialog";

/**
 * Botón "+ Nuevo Proceso" con el selector de tipo. Los tres módulos están
 * disponibles desde la Fase 5. La poligonal (Fase 35), la nivelación (Fase 36)
 * y el lugar de asentamientos (Fase 37) se dan de alta en un popup, sin salir
 * del hub.
 */
export function NewProcessSelector({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [polygonalOpen, setPolygonalOpen] = useState(false);
  const [levelingOpen, setLevelingOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nuevo Proceso</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proceso"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            Elige el tipo de proceso topográfico.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setPolygonalOpen(true);
            }}
          >
            Poligonal
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setLevelingOpen(true);
            }}
          >
            Nivelación
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(false);
              setSiteOpen(true);
            }}
          >
            Control de Asentamientos
          </Button>
        </div>
      </Modal>
      {polygonalOpen && (
        <PolygonalDetailsDialog
          mode="create"
          projectId={projectId}
          open={polygonalOpen}
          onClose={() => setPolygonalOpen(false)}
        />
      )}
      {siteOpen && (
        <SiteDialog mode="create" projectId={projectId} open={siteOpen} onClose={() => setSiteOpen(false)} />
      )}
      {levelingOpen && (
        <LevelingDetailsDialog
          mode="create"
          projectId={projectId}
          open={levelingOpen}
          onClose={() => setLevelingOpen(false)}
        />
      )}
    </>
  );
}
