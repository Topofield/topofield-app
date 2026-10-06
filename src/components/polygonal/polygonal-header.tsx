"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Alert, Badge, Breadcrumbs, Button, buttonClasses, Modal } from "@/components/design-system";
import {
  deletePolygonalProcessAction,
  duplicatePolygonalProcessAction,
  savePolygonalProcessAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { deletionReportsNotice } from "@/lib/reports/including";
import { formatEquipmentLine, formatSavedAt } from "@/lib/utils/format";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import {
  POLYGONAL_TYPE_LABELS,
  PROCESS_STATUS_LABELS,
  type PolygonalProcess,
  type PolygonalStationWithReadings,
} from "@/types/polygonal";
import { PolygonalDetailsDialog, type PolygonalDetails } from "./polygonal-details-dialog";
import { detectedOrderOf } from "./polygonal-draft";
import { draftOf, payloadOf } from "./polygonal-save";

import { callAction } from "@/lib/errors/action-call";
interface PolygonalHeaderProps {
  projectId: string;
  projectName: string;
  process: PolygonalProcess;
  stations: PolygonalStationWithReadings[];
  exportHref: string;
  /** Informes consolidados que incluyen la poligonal: borrarla los deja sin su sección. */
  reportTitles: string[];
}

const blank = (v: string | null) => (v && v.trim() !== "" ? v : null);

/**
 * La cabecera de la poligonal (Fase 35, maqueta «Datos A»): tipo, estado y
 * orden alcanzado; título; ubicación, responsable y equipo; y las acciones. Sin
 * cerrar ni reabrir: la poligonal no se cierra. Las migas se ven en la barra
 * fija (Fase 33). Es un `<header>`: no se imprime.
 */
export function PolygonalHeader({
  projectId,
  projectName,
  process,
  stations,
  exportHref,
  reportTitles,
}: PolygonalHeaderProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hubHref = `/projects/${projectId}?tab=processes&modulo=poligonales`;

  const { order, verifiable } = useMemo(() => detectedOrderOf(process, stations), [process, stations]);
  const equipment = formatEquipmentLine(
    process.equipment_brand,
    process.equipment_model,
    process.equipment_serial,
  );
  const responsible = [process.responsible_name, process.responsible_role]
    .filter((v) => v && v.trim() !== "")
    .join(" · ");

  async function saveDetails(details: PolygonalDetails) {
    const draft = draftOf(process, stations);
    draft.details = {
      name: details.name.trim(),
      location: blank(details.location),
      responsibleName: blank(details.responsibleName),
      responsibleRole: blank(details.responsibleRole),
      type: details.type,
      equipmentBrand: blank(details.equipmentBrand),
      equipmentModel: blank(details.equipmentModel),
      equipmentSerial: blank(details.equipmentSerial),
    };
    return callAction(() => savePolygonalProcessAction(payloadOf(process.id, draft)));
  }

  function duplicate() {
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => duplicatePolygonalProcessAction(process.id));
      if (r.ok) router.push(hubHref);
      else setError(r.error ?? "No se pudo duplicar la poligonal.");
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => deletePolygonalProcessAction(process.id));
      if (r.ok) router.push(hubHref);
      else setError(r.error ?? "No se pudo eliminar la poligonal.");
    });
  }

  return (
    <header className="flex flex-col gap-3 rounded-lg border border-rule bg-card px-5 py-4 shadow-sm print:hidden">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: projectName, href: hubHref },
          { label: process.name },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{`Poligonal ${POLYGONAL_TYPE_LABELS[process.type].toLowerCase()}`}</Badge>
        <Badge tone={PROCESS_STATUS_TONE[process.status]}>{PROCESS_STATUS_LABELS[process.status]}</Badge>
        {order ? (
          <Badge tone="success">{PRECISION_ORDER_LABELS[order]}</Badge>
        ) : verifiable ? (
          <Badge tone="warning">No alcanza ningún orden</Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{process.name}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {process.location && <span>{process.location}</span>}
            {responsible && <span>{responsible}</span>}
            {equipment !== "—" && <span>{equipment}</span>}
            {/* Cada popup guarda al confirmar: no hay botón Guardar (Fase 35). */}
            <span>Guardado {formatSavedAt(process.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Editar datos
          </Button>
          <a href={exportHref} className={buttonClasses({ variant: "secondary", size: "sm" })} download>
            Exportar a Excel
          </a>
          <details className="relative">
            <summary
              aria-label="Más acciones"
              className={`${buttonClasses({ variant: "ghost", size: "sm" })} cursor-pointer list-none`}
            >
              ⋯
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-44 flex-col rounded-md border border-rule bg-card p-1 shadow-lg">
              <button
                type="button"
                className="rounded px-3 py-2 text-left text-sm hover:bg-sel"
                onClick={duplicate}
                disabled={isPending}
              >
                Duplicar
              </button>
              <button
                type="button"
                className="rounded px-3 py-2 text-left text-sm text-danger hover:bg-sel"
                onClick={() => setDeleting(true)}
              >
                Eliminar
              </button>
            </div>
          </details>
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}

      {editing && (
        <PolygonalDetailsDialog
          mode="edit"
          open={editing}
          onClose={() => setEditing(false)}
          hasMeasurements={stations.length > 0}
          initial={{
            name: process.name,
            location: process.location ?? "",
            responsibleName: process.responsible_name ?? "",
            responsibleRole: process.responsible_role ?? "",
            type: process.type,
            equipmentBrand: process.equipment_brand ?? "",
            equipmentModel: process.equipment_model ?? "",
            equipmentSerial: process.equipment_serial ?? "",
          }}
          onSave={saveDetails}
        />
      )}
      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Eliminar poligonal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} disabled={isPending}>
              {isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          Se eliminará «{process.name}» con sus mediciones. Esta acción no se puede deshacer.
        </p>
        {deletionReportsNotice(reportTitles) && (
          <Alert variant="warning" className="mt-2 py-2">
            {deletionReportsNotice(reportTitles)}
          </Alert>
        )}
      </Modal>
    </header>
  );
}
