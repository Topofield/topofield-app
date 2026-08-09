"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { evaluatePolygonalClosure } from "@/lib/validators/polygonal";
import { closePolygonalProcessAction } from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import {
  POLYGONAL_TYPE_LABELS,
  type PolygonalResult,
  type PolygonalType,
} from "@/types/polygonal";

function formatMeters(value: number | null, decimals = 3): string {
  return value == null ? "—" : value.toFixed(decimals);
}

function formatPrecision(x: number | null): string {
  if (x == null) return "—";
  if (!Number.isFinite(x)) return "1:∞";
  return `1:${Math.round(x).toLocaleString("es-CO")}`;
}

interface CloseProcessDialogProps {
  processId: string;
  type: PolygonalType;
  result: PolygonalResult;
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

  const closure = evaluatePolygonalClosure(type, result, captureBlocked);
  const canConfirm = !dirty && !closure.blocked && confirmed && !isPending;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const response = await closePolygonalProcessAction({
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

          {!dirty && closure.blocked && (
            <Alert variant="error">{closure.messages.join(" ")}</Alert>
          )}

          {!dirty && !closure.blocked && (
            <>
              <div className="rounded-md border border-neutral-100 px-4 py-2">
                <SummaryRow
                  label="Tipo de poligonal"
                  value={POLYGONAL_TYPE_LABELS[type]}
                />
                <SummaryRow
                  label="Perímetro"
                  value={`${formatMeters(result.perimeter)} m`}
                />
                <SummaryRow
                  label="Error de cierre"
                  value={`${formatMeters(result.linearError, 4)} m`}
                />
                {type !== "open_uncontrolled" && (
                  <SummaryRow
                    label="Precisión relativa"
                    value={formatPrecision(result.relativePrecision)}
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
