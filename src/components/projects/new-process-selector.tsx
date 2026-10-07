"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClasses, Modal } from "@/components/design-system";
import { PolygonalDetailsDialog } from "@/components/polygonal/polygonal-details-dialog";
import { LevelingDetailsDialog } from "@/components/leveling/leveling-details-dialog";

/**
 * Botón "+ Nuevo Proceso" con el selector de tipo. Los tres módulos están
 * disponibles desde la Fase 5. La poligonal (Fase 35) y la nivelación (Fase 36)
 * se dan de alta en un popup, sin salir del hub.
 */
export function NewProcessSelector({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [polygonalOpen, setPolygonalOpen] = useState(false);
  const [levelingOpen, setLevelingOpen] = useState(false);

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
          <Link
            href={`/projects/${projectId}/sites/new`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Control de Asentamientos
          </Link>
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
