"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClasses, Modal } from "@/components/design-system";

/**
 * Botón "+ Nuevo Proceso" con el selector de tipo. En la Fase 3 solo el proceso
 * poligonal está disponible; nivelación y asentamiento llegan en Fases 4-5.
 */
export function NewProcessSelector({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nuevo Proceso</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proceso"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">
            Elige el tipo de proceso topográfico.
          </p>
          <Link
            href={`/projects/${projectId}/polygonal/new`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Poligonal
          </Link>
          <Button
            variant="secondary"
            disabled
            title="Disponible en una fase futura"
          >
            Nivelación
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Disponible en una fase futura"
          >
            Asentamiento
          </Button>
        </div>
      </Modal>
    </>
  );
}
