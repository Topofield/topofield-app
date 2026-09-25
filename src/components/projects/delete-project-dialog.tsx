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
          <p className="text-sm font-medium text-ink">
            {isActive ? "Archivar proyecto" : "Restaurar proyecto"}
          </p>
          <p className="text-xs text-ink-2">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <div>
          <p className="text-sm font-medium text-ink">
            Eliminar proyecto
          </p>
          <p className="text-xs text-ink-2">
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
        <p className="text-sm text-ink-2">
          ¿Seguro que quieres eliminar{" "}
          <span className="font-medium">{project.name}</span>? Esta acción no
          se puede deshacer y borra también sus puntos de referencia.
        </p>
      </Modal>
    </div>
  );
}
