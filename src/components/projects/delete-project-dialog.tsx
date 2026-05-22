"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/design-system";
import {
  archiveProjectAction,
  deleteProjectAction,
  restoreProjectAction,
} from "@/app/(app)/projects/[id]/actions";
import type { Project } from "@/types/project";

export function DeleteProjectDialog({ project }: { project: Project }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isActive = project.status === "active";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-800">
            {isActive ? "Archivar proyecto" : "Restaurar proyecto"}
          </p>
          <p className="text-xs text-neutral-500">
            {isActive
              ? "El proyecto se oculta de la lista activa. Puedes restaurarlo cuando quieras."
              : "El proyecto vuelve a la lista de proyectos activos."}
          </p>
        </div>
        <form action={isActive ? archiveProjectAction : restoreProjectAction}>
          <input type="hidden" name="project_id" value={project.id} />
          <Button type="submit" variant="secondary">
            {isActive ? "Archivar" : "Restaurar"}
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <div>
          <p className="text-sm font-medium text-neutral-800">
            Eliminar proyecto
          </p>
          <p className="text-xs text-neutral-500">
            Borra el proyecto y sus puntos de referencia de forma permanente.
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          Eliminar
        </Button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Eliminar proyecto"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <form action={deleteProjectAction}>
              <input type="hidden" name="project_id" value={project.id} />
              <Button type="submit" variant="danger">
                Eliminar definitivamente
              </Button>
            </form>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          ¿Seguro que quieres eliminar{" "}
          <span className="font-medium">{project.name}</span>? Esta acción no
          se puede deshacer y borra también sus puntos de referencia.
        </p>
      </Modal>
    </div>
  );
}
