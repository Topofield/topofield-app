"use client";

import { useState } from "react";
import { Alert, Button, Modal } from "@/components/design-system";
import { formatBookClosure } from "@/lib/utils/format";
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
  /**
   * Códigos de los puntos con lectura fuera de tendencia (Fase 12). Cerrar
   * congela el dato, así que se recuerdan aquí; no bloquean.
   */
  trendDeviationCodes: string[];
  /**
   * Resumen de la libreta de la visita (Fase 18); null en cotas directas. La
   * comprobación aritmética fallida bloquea; la tolerancia solo avisa.
   */
  book?: {
    closureErrorMm: number | null;
    toleranceMm: number | null;
    meetsTolerance: boolean | null;
    arithmeticCheckOk: boolean;
  } | null;
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
  trendDeviationCodes,
  book = null,
}: CloseVisitDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  const bookBlocked = book != null && !book.arithmeticCheckOk;
  const canConfirm = !dirty && !bookBlocked && confirmed && !isPending;
  const closure = book
    ? formatBookClosure(book.closureErrorMm, book.toleranceMm, book.meetsTolerance)
    : null;

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

        <p className="text-sm text-ink-2">
          El cierre deja la visita en solo lectura, con responsable y fecha
          de registro. Esta acción no se puede deshacer.
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-2">Fecha de la visita</dt>
          <dd className="text-ink">{formatDate(visitDate)}</dd>
          <dt className="text-ink-2">Puntos medidos</dt>
          <dd className="text-ink">{pointsMeasured}</dd>
          <dt className="text-ink-2">Peor nivel de alerta</dt>
          <dd className="text-ink">{ALERT_LEVEL_LABELS[worstAlert]}</dd>
          <dt className="text-ink-2">Fecha y hora de cierre</dt>
          <dd className="text-ink">{now}</dd>
          {closure && (
            <>
              <dt className="text-ink-2">Cierre de la libreta</dt>
              <dd className="text-ink">
                {closure.value} · {closure.detail}
              </dd>
            </>
          )}
          {trendDeviationCodes.length > 0 && (
            <>
              <dt className="text-ink-2">Lecturas fuera de tendencia</dt>
              <dd className="text-warning">
                {trendDeviationCodes.join(", ")}
              </dd>
            </>
          )}
        </dl>

        {bookBlocked && (
          <Alert variant="error">
            La comprobación aritmética de la libreta no cuadra. Corrige la
            libreta antes de cerrar la visita.
          </Alert>
        )}
        {closure?.status === "out" && (
          <Alert variant="warning">
            El cierre de la libreta supera la tolerancia. La visita se cierra
            igual, con sus cotas sin compensar.
          </Alert>
        )}

        {worstAlert === "alarm" || worstAlert === "alert" ? (
          <Alert variant="warning">
            Esta visita registra puntos en{" "}
            {ALERT_LEVEL_LABELS[worstAlert].toLowerCase()}. El cierre queda
            igualmente registrado: el nivel de alerta es un hallazgo del
            monitoreo, no un impedimento.
          </Alert>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="h-4 w-4 rounded border-rule-strong"
          />
          Confirmo que los datos son correctos
        </label>
      </div>
    </Modal>
  );
}
