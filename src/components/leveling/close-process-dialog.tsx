"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { evaluateLevelingClosure } from "@/lib/validators/leveling";
import { closeLevelingProcessAction } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { LEVELING_TYPE_LABELS, type LevelingResult, type LevelingType } from "@/types/leveling";

function formatMm(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(1)} mm`;
}

interface CloseProcessDialogProps {
  processId: string;
  type: LevelingType;
  result: LevelingResult;
  captureBlocked: boolean;
  dirty: boolean;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm tabular-nums text-neutral-900">{value}</span>
    </div>
  );
}

/**
 * Diálogo de cierre del proceso de nivelación. Réplica del de poligonal
 * (`src/components/polygonal/close-process-dialog.tsx`), adaptada a que
 * `evaluateLevelingClosure` ya resuelve `blocked`/`mustReject` a partir del
 * `LevelingResult`, sin necesitar el tipo aparte que sí exige poligonal.
 */
export function CloseProcessDialog({
  processId,
  type,
  result,
  captureBlocked,
  dirty,
}: CloseProcessDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const closure = evaluateLevelingClosure(result);
  const canConfirm = !dirty && !captureBlocked && !closure.blocked && confirmed && !isPending;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const response = await closeLevelingProcessAction({
        processId,
        asRejected: closure.mustReject,
      });
      // En éxito, revalidatePath vuelve a renderizar el editor en solo lectura.
      if (response.ok) setOpen(false);
      else setError(response.error ?? "No se pudo cerrar el proceso.");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          setConfirmed(false);
          setError(null);
          setOpen(true);
        }}
      >
        Cerrar proceso
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Cerrar proceso"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant={closure.mustReject ? "danger" : "primary"}
              disabled={!canConfirm}
              onClick={handleConfirm}
            >
              {isPending
                ? "Cerrando…"
                : closure.mustReject
                  ? "Cerrar como rechazado"
                  : "Confirmar cierre"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Alert variant="error">{error}</Alert>}

          {dirty && (
            <Alert variant="warning">
              Tienes cambios sin guardar. Guárdalos antes de cerrar el proceso.
            </Alert>
          )}

          {!dirty && captureBlocked && (
            <Alert variant="error">
              Corrige las celdas con error de captura antes de cerrar el proceso.
            </Alert>
          )}

          {!dirty && !captureBlocked && closure.blocked && (
            <Alert variant="error">{closure.messages.join(" ")}</Alert>
          )}

          {!dirty && !captureBlocked && !closure.blocked && (
            <>
              <div className="rounded-md border border-neutral-100 px-4 py-2">
                <SummaryRow
                  label="Tipo de nivelación"
                  value={LEVELING_TYPE_LABELS[type]}
                />
                <SummaryRow
                  label="Error de cierre"
                  value={formatMm(result.closureErrorMm)}
                />
                <SummaryRow
                  label="Tolerancia"
                  value={formatMm(result.toleranceMm)}
                />
                {result.discrepancyMm != null && (
                  <SummaryRow
                    label="Discrepancia ida/vuelta"
                    value={formatMm(result.discrepancyMm)}
                  />
                )}
                <SummaryRow
                  label="Fecha y hora"
                  value={new Date().toLocaleString("es-CO", {
                    timeZone: "America/Bogota",
                  })}
                />
              </div>

              {closure.messages.length > 0 && (
                <Alert variant="warning">{closure.messages.join(" ")}</Alert>
              )}

              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-400"
                />
                Confirmo que los datos son correctos.
              </label>
              <p className="text-xs text-neutral-500">
                Al cerrar, el proceso queda inmutable y de solo lectura.
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
