"use client";

import { useState } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { ALERT_LEVEL_LABELS, type AlertLevel } from "@/types/settlement";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

interface CloseVisitDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
  /** Datos del resumen que pide el § 4.6. */
  visitDate: string;
  pointsMeasured: number;
  worstAlert: AlertLevel;
  /**
   * Hay cambios sin guardar en el editor. Mismo patrón que
   * `close-process-dialog.tsx` de poligonal: cerrar con cambios sin guardar
   * sellaría los valores VIEJOS de la base como si fueran los que se ven en
   * pantalla — irreversible, porque una visita cerrada es inmutable.
   */
  dirty: boolean;
}

/**
 * Confirmación de cierre de una visita (§ 4.6): resumen (fecha, puntos
 * medidos, peor alerta, ahora) y checkbox de confirmación obligatorio.
 *
 * Un nivel de alerta/alarma se muestra como advertencia, nunca como
 * impedimento: el cierre siempre procede si el usuario confirma. Lo único
 * que bloquea el cierre es la validación del servidor (lecturas
 * incompletas), y ese error se muestra sin cerrar el modal.
 */
export function CloseVisitDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  error,
  visitDate,
  pointsMeasured,
  worstAlert,
  dirty,
}: CloseVisitDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  const canConfirm = !dirty && confirmed && !isPending;

  const now = new Intl.DateTimeFormat("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date());

  function handleClose() {
    setConfirmed(false);
    onClose();
  }

  return (
    <Modal
      open
      onClose={handleClose}
      title="Cerrar visita"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {isPending ? "Cerrando…" : "Confirmar Cierre"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}

        {dirty && (
          <Alert variant="warning">
            Tienes cambios sin guardar. Guárdalos antes de cerrar la visita.
          </Alert>
        )}

        <p className="text-sm text-neutral-700">
          El cierre deja la visita en solo lectura, con responsable y fecha
          de registro. Esta acción no se puede deshacer.
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Fecha de la visita</dt>
          <dd className="text-neutral-900">{formatDate(visitDate)}</dd>
          <dt className="text-neutral-500">Puntos medidos</dt>
          <dd className="text-neutral-900">{pointsMeasured}</dd>
          <dt className="text-neutral-500">Peor nivel de alerta</dt>
          <dd className="text-neutral-900">{ALERT_LEVEL_LABELS[worstAlert]}</dd>
          <dt className="text-neutral-500">Fecha y hora de cierre</dt>
          <dd className="text-neutral-900">{now}</dd>
        </dl>

        {worstAlert === "alarm" || worstAlert === "alert" ? (
          <Alert variant="warning">
            Esta visita registra puntos en{" "}
            {ALERT_LEVEL_LABELS[worstAlert].toLowerCase()}. El cierre queda
            igualmente registrado: el nivel de alerta es un hallazgo del
            monitoreo, no un impedimento.
          </Alert>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
          />
          Confirmo que los datos son correctos
        </label>
      </div>
    </Modal>
  );
}
