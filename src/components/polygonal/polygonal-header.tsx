"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/design-system";
import { ProcessHeader } from "@/components/process/process-header";
import {
  deletePolygonalProcessAction,
  duplicatePolygonalProcessAction,
  savePolygonalProcessAction,
} from "@/app/(app)/projects/[id]/polygonal/[pid]/actions";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { formatEquipmentLine } from "@/lib/utils/format";
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
  /** En el paso de Informe, la primera acción es imprimirlo. */
  printable?: boolean;
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
  printable = false,
}: PolygonalHeaderProps) {
  const [editing, setEditing] = useState(false);
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

  return (
    <ProcessHeader
      projectName={projectName}
      hubHref={hubHref}
      title={process.name}
      badges={
        <>
          <Badge>{`Poligonal ${POLYGONAL_TYPE_LABELS[process.type].toLowerCase()}`}</Badge>
          <Badge tone={PROCESS_STATUS_TONE[process.status]}>{PROCESS_STATUS_LABELS[process.status]}</Badge>
          {order ? (
            <Badge tone="success">{PRECISION_ORDER_LABELS[order]}</Badge>
          ) : verifiable ? (
            <Badge tone="warning">No alcanza ningún orden</Badge>
          ) : null}
        </>
      }
      location={process.location}
      responsible={responsible}
      equipment={equipment !== "—" ? equipment : null}
      updatedAt={process.updated_at}
      exportHref={exportHref}
      printable={printable}
      onEdit={() => setEditing(true)}
      duplicate={() => duplicatePolygonalProcessAction(process.id)}
      remove={() => deletePolygonalProcessAction(process.id)}
      subject="la poligonal"
      deleteTitle="Eliminar poligonal"
      deleteWhat="con sus mediciones"
    >
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
    </ProcessHeader>
  );
}
