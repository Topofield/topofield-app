"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Input, Modal } from "@/components/design-system";
import {
  deletePolygonalProcessAction,
  duplicatePolygonalProcessAction,
  renamePolygonalProcessAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import {
  deleteLevelingProcessAction,
  duplicateLevelingProcessAction,
  renameLevelingProcessAction,
} from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import {
  deleteSiteAction,
  duplicateSiteAction,
  renameSiteAction,
} from "@/app/(app)/projects/[id]/sites/actions";

export type RowKind = "polygonal" | "leveling" | "site";

type Result = { ok: boolean; error?: string };

/** Las acciones de servidor y los textos de cada tipo (Fase 22: los tres). */
const KINDS: Record<
  RowKind,
  {
    duplicate: (id: string) => Promise<Result>;
    rename: (id: string, name: string) => Promise<Result>;
    remove: (id: string) => Promise<Result>;
    noun: string;
    /** Lo que se va con el borrado. */
    deletes: string;
  }
> = {
  polygonal: {
    duplicate: duplicatePolygonalProcessAction,
    rename: renamePolygonalProcessAction,
    remove: deletePolygonalProcessAction,
    noun: "proceso",
    deletes: "y todas sus estaciones",
  },
  leveling: {
    duplicate: duplicateLevelingProcessAction,
    rename: renameLevelingProcessAction,
    remove: deleteLevelingProcessAction,
    noun: "proceso",
    deletes: "y todas sus lecturas",
  },
  site: {
    duplicate: duplicateSiteAction,
    rename: renameSiteAction,
    remove: deleteSiteAction,
    noun: "lugar",
    deletes: "con su catálogo de puntos y sus visitas",
  },
};

interface ProcessRowActionsProps {
  kind: RowKind;
  id: string;
  name: string;
  /** Cerrado o rechazado: solo se puede duplicar. */
  closed: boolean;
}

/**
 * Acciones por fila del listado del hub, para poligonales, nivelaciones y
 * lugares. Lo cerrado solo admite duplicar: renombrar y eliminar quedan
 * ocultos, no deshabilitados — una acción visible pero inerte invita a
 * intentarla.
 */
export function ProcessRowActions({ kind, id, name, closed }: ProcessRowActionsProps) {
  const k = KINDS[kind];
  const [renombrando, setRenombrando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [nombre, setNombre] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<Result>) {
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

  function duplicar() {
    setDuplicateError(null);
    startTransition(async () => {
      const r = await k.duplicate(id);
      if (!r.ok) setDuplicateError(r.error ?? `No se pudo duplicar el ${k.noun}.`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          type="button"
          aria-label={`Duplicar «${name}»`}
          disabled={isPending}
          onClick={duplicar}
        >
          Duplicar
        </Button>

        {!closed && (
          <>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              aria-label={`Renombrar «${name}»`}
              onClick={() => {
                setNombre(name);
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
              aria-label={`Eliminar «${name}»`}
              onClick={() => {
                setError(null);
                setEliminando(true);
              }}
            >
              Eliminar
            </Button>
          </>
        )}
      </div>

      {duplicateError && (
        <Alert variant="error" className="w-full max-w-xs py-2">
          {duplicateError}
        </Alert>
      )}

      <Modal
        open={renombrando}
        onClose={() => setRenombrando(false)}
        title={`Renombrar ${k.noun}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenombrando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={isPending || nombre.trim() === ""}
              onClick={() => ejecutar(() => k.rename(id, nombre))}
            >
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
        <Input
          label={`Nombre del ${k.noun}`}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        {error && (
          <Alert variant="error" className="mt-2 py-2">
            {error}
          </Alert>
        )}
      </Modal>

      <Modal
        open={eliminando}
        onClose={() => setEliminando(false)}
        title={`Eliminar ${k.noun}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEliminando(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              onClick={() => ejecutar(() => k.remove(id))}
            >
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Se eliminará «{name}» {k.deletes}. Esta acción no se puede deshacer.
        </p>
        {error && (
          <Alert variant="error" className="mt-2 py-2">
            {error}
          </Alert>
        )}
      </Modal>
    </div>
  );
}
