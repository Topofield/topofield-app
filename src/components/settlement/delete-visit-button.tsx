"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { deleteVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";

interface DeleteVisitButtonProps {
  projectId: string;
  siteId: string;
  visitId: string;
  visitLabel: string;
  /** Adónde ir después de eliminarla: el panel del lugar. */
  afterHref: string;
}

/**
 * Elimina la última visita de un lugar, si no está cerrada (Fase 22). La
 * vista solo lo ofrece en ese caso; la acción lo vuelve a comprobar.
 */
export function DeleteVisitButton({
  projectId,
  siteId,
  visitId,
  visitLabel,
  afterHref,
}: DeleteVisitButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await deleteVisitAction(projectId, siteId, visitId);
      if (r.ok) {
        router.push(afterHref);
      } else {
        setError(r.error ?? "No se pudo eliminar la visita.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Eliminar
      </Button>
      <Modal
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title="Eliminar visita"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmar} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>
            Se eliminará la {visitLabel.toLowerCase()} con sus lecturas y su libreta. Esta acción no
            se puede deshacer.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
