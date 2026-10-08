"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/design-system";
import { ProcessHeader } from "@/components/process/process-header";
import {
  deleteLevelingProcessAction,
  duplicateLevelingProcessAction,
  saveLevelingProcessAction,
} from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import { computeLevelingDetected } from "@/lib/calculations/leveling";
import { callAction } from "@/lib/errors/action-call";
import { PROCESS_STATUS_TONE } from "@/lib/process-status";
import { formatEquipmentLine } from "@/lib/utils/format";
import { levelingKindLabel, type LevelingProcess, type LevelingReading } from "@/types/leveling";
import { PROCESS_STATUS_LABELS } from "@/types/polygonal";
import { PRECISION_ORDER_LABELS } from "@/types/project";
import { armadaSpans } from "./armadas";
import { LevelingDetailsDialog } from "./leveling-details-dialog";
import type { LevelingDetails, LevelingDetailsForm } from "./leveling-details";
import { draftWithBm, levelingDraftOf, levelingInputOf, levelingPayloadOf } from "./leveling-save";

interface LevelingHeaderProps {
  projectId: string;
  projectName: string;
  process: LevelingProcess;
  readings: LevelingReading[];
  exportHref: string;
  printable?: boolean;
}

const blank = (v: string) => (v.trim() === "" ? null : v.trim());

function formOf(p: LevelingProcess): LevelingDetailsForm {
  return {
    name: p.name,
    type: p.type,
    hasReturnRun: p.has_return_run,
    startBmCode: p.start_bm_code,
    startBmElevation: String(p.start_bm_elevation),
    endBmCode: p.end_bm_code ?? "",
    endBmElevation: p.end_bm_elevation != null ? String(p.end_bm_elevation) : "",
    location: p.location ?? "",
    responsibleName: p.responsible_name ?? "",
    responsibleRole: p.responsible_role ?? "",
    equipmentBrand: p.equipment_brand ?? "",
    equipmentModel: p.equipment_model ?? "",
    equipmentSerial: p.equipment_serial ?? "",
  };
}

/**
 * La cabecera de la nivelación (Fase 36): tipo, estado y orden alcanzado
 * —detectado con lo guardado—, título, ubicación, responsable y equipo, y las
 * acciones. Sin cerrar ni reabrir: la nivelación no se cierra.
 */
export function LevelingHeader({
  projectId,
  projectName,
  process,
  readings,
  exportHref,
  printable = false,
}: LevelingHeaderProps) {
  const [editing, setEditing] = useState(false);
  const hubHref = `/projects/${projectId}?tab=processes&modulo=nivelaciones`;
  const { order, verifiable } = useMemo(
    () => computeLevelingDetected(levelingInputOf(levelingDraftOf(process, readings))),
    [process, readings],
  );
  const equipment = formatEquipmentLine(process.equipment_brand, process.equipment_model, process.equipment_serial);
  const responsible = [process.responsible_name, process.responsible_role]
    .filter((v) => v && v.trim() !== "")
    .join(" · ");

  async function saveDetails(d: LevelingDetails) {
    const draft = levelingDraftOf(process, readings);
    draft.details = {
      ...draft.details,
      name: d.name.trim(),
      type: d.type,
      hasReturnRun: d.hasReturnRun,
      location: blank(d.location),
      responsibleName: blank(d.responsibleName),
      responsibleRole: blank(d.responsibleRole),
      equipmentBrand: blank(d.equipmentBrand),
      equipmentModel: blank(d.equipmentModel),
      equipmentSerial: blank(d.equipmentSerial),
    };
    // Los extremos de la libreta que llevaban el código del BM cambian con él.
    const next = draftWithBm(draft, {
      startCode: d.startBmCode.trim(),
      startElevation: d.startBmElevation,
      endCode: d.type === "link" ? d.endBmCode.trim() : null,
      endElevation: d.type === "link" ? d.endBmElevation : null,
    });
    return callAction(() => saveLevelingProcessAction(levelingPayloadOf(process.id, next)));
  }

  return (
    <ProcessHeader
      projectName={projectName}
      hubHref={hubHref}
      title={process.name}
      badges={
        <>
          <Badge>{levelingKindLabel(process.type, process.has_return_run)}</Badge>
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
      duplicate={() => duplicateLevelingProcessAction(process.id)}
      remove={() => deleteLevelingProcessAction(process.id)}
      subject="la nivelación"
      deleteTitle="Eliminar nivelación"
      deleteWhat="con su libreta"
    >
      {editing && (
        <LevelingDetailsDialog
          mode="edit"
          open={editing}
          onClose={() => setEditing(false)}
          hasReadings={readings.length > 1}
          returnArmadas={armadaSpans(levelingDraftOf(process, readings).return).length}
          initial={formOf(process)}
          onSave={saveDetails}
        />
      )}
    </ProcessHeader>
  );
}
