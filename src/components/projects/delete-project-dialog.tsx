"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import {
  archiveProjectAction,
  deleteProjectAction,
  restoreProjectAction,
} from "@/app/(app)/projects/[id]/actions";
import type { Project } from "@/types/project";

export function DeleteProjectDialog({
  project,
  closedWork,
}: {
  project: Project;
  /** Procesos, lugares y visitas cerrados: con alguno, no se puede eliminar. */
  closedWork: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isActive = project.status === "active";

  function eliminar() {
    setError(null);
    startTransition(async () => {
      // Si funciona, la acción redirige al dashboard.
      const r = await deleteProjectAction(project.id);
      if (!r.ok) setError(r.error ?? "No se pudo eliminar el proyecto.");
    });
  }

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
            {closedWork > 0
              ? `Tiene ${closedWork} ${closedWork === 1 ? "registro cerrado" : "registros cerrados"} (procesos, lugares o visitas), que no se pueden borrar. Si ya no lo usas, archívalo.`
              : "Borra el proyecto con sus procesos, lugares y puntos de referencia, de forma permanente."}
          </p>
        </div>
        {closedWork === 0 && (
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Eliminar
          </Button>
        )}
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
            <Button variant="danger" onClick={eliminar} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          ¿Seguro que quieres eliminar{" "}
          <span className="font-medium">{project.name}</span>? Esta acción no
          se puede deshacer y borra también sus procesos, lugares y puntos de
          referencia.
        </p>
        {error && (
          <Alert variant="error" className="mt-3">
            {error}
          </Alert>
        )}
      </Modal>
    </div>
  );
}
