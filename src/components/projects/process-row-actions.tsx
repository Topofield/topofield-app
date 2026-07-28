"use client";

import { useState, useTransition } from "react";
import { Button, Input, Modal } from "@/components/design-system";
import {
  deletePolygonalProcessAction,
  duplicatePolygonalProcessAction,
  renamePolygonalProcessAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import type { PolygonalProcess } from "@/types/polygonal";

/**
 * Acciones por fila del listado. Los procesos cerrados solo admiten duplicar:
 * renombrar y eliminar quedan ocultos, no deshabilitados — una acción visible
 * pero inerte invita a intentarla.
 */
export function ProcessRowActions({
  process,
}: {
  process: PolygonalProcess;
}) {
  const inmutable =
    process.status === "closed" || process.status === "rejected";
  const [renombrando, setRenombrando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [nombre, setNombre] = useState(process.name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (r.ok) {
        setRenombrando(false);
        setEliminando(false);
      } else {
        setError(r.error ?? "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        type="button"
        disabled={isPending}
        onClick={() => ejecutar(() => duplicatePolygonalProcessAction(process.id))}
      >
        Duplicar
      </Button>

      {!inmutable && (
        <>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              setNombre(process.name);
              setError(null);
              setRenombrando(true);
            }}
          >
            Renombrar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={() => {
              setError(null);
              setEliminando(true);
            }}
          >
            Eliminar
          </Button>
        </>
      )}

      <Modal
        open={renombrando}
        onClose={() => setRenombrando(false)}
        title="Renombrar proceso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenombrando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || nombre.trim() === ""}
              onClick={() =>
                ejecutar(() => renamePolygonalProcessAction(process.id, nombre))
              }
            >
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <Input
          label="Nombre del proceso"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error ?? undefined}
        />
      </Modal>

      <Modal
        open={eliminando}
        onClose={() => setEliminando(false)}
        title="Eliminar proceso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEliminando(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() =>
                ejecutar(() => deletePolygonalProcessAction(process.id))
              }
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Se eliminará «{process.name}» y todas sus estaciones. Esta acción no se
          puede deshacer.
        </p>
        {error && <p className="mt-2 text-sm text-danger-500">{error}</p>}
      </Modal>
    </div>
  );
}
