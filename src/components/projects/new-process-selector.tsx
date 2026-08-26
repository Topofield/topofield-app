"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonClasses, Modal } from "@/components/design-system";

/**
 * Botón "+ Nuevo Proceso" con el selector de tipo. Los tres módulos están
 * disponibles desde la Fase 5.
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
          <Link
            href={`/projects/${projectId}/leveling/new`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Nivelación
          </Link>
          <Link
            href={`/projects/${projectId}/sites/new`}
            className={buttonClasses({ variant: "secondary" })}
          >
            Control de Asentamientos
          </Link>
        </div>
      </Modal>
    </>
  );
}
