"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { REOPEN_COPY, reportsNotice, type ReopenTarget } from "@/lib/reopen";

interface ReopenDialogProps {
  target: ReopenTarget;
  /** La Server Action, ya ligada a su id (`reopen…Action.bind(null, id)`). */
  action: () => Promise<{ ok: boolean; error?: string }>;
  /** Títulos de los informes consolidados que lo incluyen. */
  reportTitles?: string[];
  /** Un aviso más, como el de las visitas posteriores. */
  notice?: string | null;
  /** Si no se puede reabrir, por qué: el diálogo lo dice y no deja confirmar. */
  blocked?: string | null;
}

/**
 * Reabrir lo cerrado (Fase 34): un proceso, una visita o un lugar vuelve a
 * quedar abierto y editable. Sirve a los cuatro casos: la acción llega ligada
 * y el diálogo no sabe de módulos.
 */
export function ReopenDialog({
  target,
  action,
  reportTitles = [],
  notice = null,
  blocked = null,
}: ReopenDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const copy = REOPEN_COPY[target];
  const reports = reportsNotice(reportTitles);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const response = await action();
      // En éxito, revalidatePath de cada acción rehace la pantalla, ya abierta.
      if (response.ok) setOpen(false);
      else setError(response.error ?? "No se pudo reabrir.");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Reabrir
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={copy.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={blocked != null || isPending} onClick={handleConfirm}>
              {isPending ? "Reabriendo…" : copy.title}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}
          {blocked ? (
            <Alert variant="warning">{blocked}</Alert>
          ) : (
            <>
              <p className="text-sm text-ink">{copy.body}</p>
              {reports && <Alert variant="warning">{reports}</Alert>}
              {notice && <Alert variant="warning">{notice}</Alert>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
