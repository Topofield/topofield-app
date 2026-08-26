"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Input, Modal, StatusIndicator } from "@/components/design-system";
import { createVisitAction } from "@/app/(app)/projects/[id]/settlement/[siteId]/actions";
import {
  ALERT_LEVEL_LABELS,
  VISIT_STATUS_LABELS,
  type AlertLevel,
  type SettlementVisit,
} from "@/types/settlement";

const STATUS_TONE = {
  draft: "neutral",
  calculated: "primary",
  closed: "success",
} as const;

interface VisitRow {
  visit: SettlementVisit;
  /** Peor nivel de alerta de la visita, ya calculado por `computeHistory`. */
  worstAlert: AlertLevel;
}

interface VisitsListProps {
  projectId: string;
  siteId: string;
  rows: VisitRow[];
  /** Sin alta de visitas cuando el lugar está cerrado. */
  disabled?: boolean;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

/**
 * Lista cronológica de visitas de un lugar, con su estado, su peor nivel de
 * alerta y el alta de una visita nueva (patrón de `points-catalog.tsx`:
 * acción como función dentro de `startTransition`, modal que se cierra en el
 * callback de éxito).
 */
export function VisitsList({ projectId, siteId, rows, disabled }: VisitsListProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openModal() {
    setError(null);
    setDate(new Date().toISOString().slice(0, 10));
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (date.trim() === "") {
      setError("La fecha es obligatoria.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const response = await createVisitAction(projectId, siteId, date);
      if (response.ok) {
        closeModal();
      } else {
        setError(response.error ?? "Ocurrió un error.");
      }
    });
  }

  return (
    <Card
      title="Visitas"
      actions={
        !disabled && (
          <Button size="sm" onClick={openModal}>
            + Nueva visita
          </Button>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Aún no hay visitas registradas en este lugar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="py-2 pr-3 font-medium">Visita</th>
                <th className="py-2 pr-3 font-medium">Fecha</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 pr-3 font-medium">Peor alerta</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ visit, worstAlert }) => (
                <tr
                  key={visit.id}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="py-2 pr-3 font-medium text-neutral-900">
                    {visit.visit_number === 0
                      ? "Línea base"
                      : `Visita ${visit.visit_number}`}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">
                    {formatDate(visit.date)}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={STATUS_TONE[visit.status]}>
                      {VISIT_STATUS_LABELS[visit.status]}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <StatusIndicator
                      level={worstAlert}
                      label={ALERT_LEVEL_LABELS[worstAlert]}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Link
                      href={`/projects/${projectId}/settlement/${siteId}/visits/${visit.id}`}
                      className="text-sm font-medium text-primary-600 hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal open onClose={closeModal} title="Nueva visita">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && <Alert variant="error">{error}</Alert>}
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creando…" : "Crear visita"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}
