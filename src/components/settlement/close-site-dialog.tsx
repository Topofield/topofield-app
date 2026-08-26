"use client";

import { useState } from "react";
import { Alert, Button, Modal } from "@/components/design-system";

interface CloseSiteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
  /** Datos del resumen que pide el § 4.6. */
  siteName: string;
  pointsCount: number;
  visitsTotal: number;
  visitsOpen: number;
  /**
   * Hay cambios sin guardar en el formulario. Mismo criterio que los otros
   * tres diálogos de cierre: cerrar con cambios pendientes sellaría los
   * valores VIEJOS de la base como si fueran los de la pantalla, y un lugar
   * cerrado es inmutable.
   */
  dirty: boolean;
}

/**
 * Confirmación de cierre de un lugar (§ 4.6): resumen y checkbox obligatorio.
 *
 * Es el cierre de mayor alcance del producto —además del lugar, congela
 * TODAS sus visitas de una vez— y hasta la Fase 6 era el único de los cuatro
 * que no pedía la confirmación explícita que el § 4.6 exige en su paso 3:
 * bastaba un clic. Los otros tres, que cierran una sola entidad, sí la
 * pedían.
 *
 * El resumen destaca cuántas visitas ABIERTAS se van a congelar, porque es la
 * consecuencia que el usuario no puede deducir del nombre del lugar y la que
 * no tiene vuelta atrás.
 */
export function CloseSiteDialog({
  open,
  onClose,
  onConfirm,
  isPending,
  error,
  siteName,
  pointsCount,
  visitsTotal,
  visitsOpen,
  dirty,
}: CloseSiteDialogProps) {
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
      title="Cerrar lugar"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
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
            Tienes cambios sin guardar. Guárdalos antes de cerrar el lugar.
          </Alert>
        )}

        <p className="text-sm text-neutral-700">
          Cerrar el lugar finaliza el monitoreo: queda en solo lectura, con
          responsable y fecha de registro. Esta acción no se puede deshacer.
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Lugar</dt>
          <dd className="text-neutral-900">{siteName}</dd>
          <dt className="text-neutral-500">Puntos del catálogo</dt>
          <dd className="text-neutral-900 tabular-nums">{pointsCount}</dd>
          <dt className="text-neutral-500">Visitas registradas</dt>
          <dd className="text-neutral-900 tabular-nums">{visitsTotal}</dd>
          <dt className="text-neutral-500">Fecha y hora de cierre</dt>
          <dd className="text-neutral-900">{now}</dd>
        </dl>

        {visitsOpen > 0 && (
          <Alert variant="warning">
            {visitsOpen === 1
              ? "Hay 1 visita abierta que quedará cerrada junto con el lugar y no admitirá más ediciones."
              : `Hay ${visitsOpen} visitas abiertas que quedarán cerradas junto con el lugar y no admitirán más ediciones.`}
          </Alert>
        )}

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
