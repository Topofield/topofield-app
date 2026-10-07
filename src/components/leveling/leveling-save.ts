// El borrador de una nivelación y la carga de su guardado (Fase 36). Cada popup
// arma la carga completa: la acción reescribe la cabecera y la libreta entera
// en una transacción, y recalcula en el servidor. Sin «use client»: lo usan la
// pantalla, la acción de crear y las pruebas.
import type { ReadingDraft, SaveLevelingPayload } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { LevelingProcess, LevelingReading, LevelingType } from "@/types/leveling";

export interface LevelingDetails {
  name: string;
  type: LevelingType;
  hasReturnRun: boolean;
  location: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  notes: string | null;
}

export interface LevelingBm {
  startCode: string;
  startElevation: number;
  endCode: string | null;
  endElevation: number | null;
}

export interface LevelingDraft {
  details: LevelingDetails;
  bm: LevelingBm;
  forward: ReadingDraft[];
  return: ReadingDraft[];
}

const num = (v: number | string | null | undefined): number | null =>
  v == null || v === "" ? null : Number(v);

function draftOfRow(r: LevelingReading): ReadingDraft {
  return {
    pointCode: r.point_code,
    pointType: r.point_type,
    backsight: num(r.backsight),
    foresight: num(r.foresight),
    backUpperM: num(r.back_upper_m),
    backLowerM: num(r.back_lower_m),
    foreUpperM: num(r.fore_upper_m),
    foreLowerM: num(r.fore_lower_m),
    backDistanceM: num(r.back_distance_m),
    foreDistanceM: num(r.fore_distance_m),
  };
}

function runOf(readings: readonly LevelingReading[], run: "forward" | "return"): ReadingDraft[] {
  return readings
    .filter((r) => r.run_type === run)
    .sort((a, b) => a.reading_order - b.reading_order)
    .map(draftOfRow);
}

/** El borrador de una nivelación tal como está guardada. */
export function levelingDraftOf(
  process: LevelingProcess,
  readings: readonly LevelingReading[],
): LevelingDraft {
  return {
    details: {
      name: process.name,
      type: process.type,
      hasReturnRun: process.has_return_run,
      location: process.location,
      responsibleName: process.responsible_name,
      responsibleRole: process.responsible_role,
      equipmentBrand: process.equipment_brand,
      equipmentModel: process.equipment_model,
      equipmentSerial: process.equipment_serial,
      notes: process.notes,
    },
    bm: {
      startCode: process.start_bm_code,
      startElevation: Number(process.start_bm_elevation),
      endCode: process.end_bm_code,
      endElevation: num(process.end_bm_elevation),
    },
    forward: runOf(readings, "forward"),
    return: runOf(readings, "return"),
  };
}

/** La carga del guardado, completa. El orden de precisión no viaja: se detecta. */
export function levelingPayloadOf(processId: string, draft: LevelingDraft): SaveLevelingPayload {
  const { details: d, bm } = draft;
  const link = d.type === "link";
  return {
    processId,
    name: d.name,
    type: d.type,
    startBmCode: bm.startCode,
    startBmElevation: bm.startElevation,
    endBmCode: link ? bm.endCode : null,
    endBmElevation: link ? bm.endElevation : null,
    hasReturnRun: d.hasReturnRun,
    location: d.location,
    responsibleName: d.responsibleName,
    responsibleRole: d.responsibleRole,
    equipmentBrand: d.equipmentBrand,
    equipmentModel: d.equipmentModel,
    equipmentSerial: d.equipmentSerial,
    notes: d.notes,
    forward: draft.forward,
    return: d.hasReturnRun ? draft.return : [],
  };
}
