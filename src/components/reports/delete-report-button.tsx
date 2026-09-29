"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { deleteReportAction } from "@/app/(app)/projects/[id]/reports/actions";

interface DeleteReportButtonProps {
  projectId: string;
  reportId: string;
  title: string;
}

/** Elimina un informe consolidado, con confirmación (Fase 22). */
export function DeleteReportButton({ projectId, reportId, title }: DeleteReportButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await deleteReportAction(projectId, reportId);
      if (r.ok) {
        router.push(`/projects/${projectId}?tab=reports`);
      } else {
        setError(r.error ?? "No se pudo eliminar el informe.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Eliminar informe
      </Button>
      <Modal
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title="Eliminar informe"
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
            Se eliminará el informe «{title}». Los procesos que incluye no cambian: puedes volver a
            generarlo cuando quieras.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      </Modal>
    </>
  );
}
