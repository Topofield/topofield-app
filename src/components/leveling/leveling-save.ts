// El borrador de una nivelación y la carga de su guardado (Fase 36). Cada popup
// arma la carga completa: la acción reescribe la cabecera y la libreta entera
// en una transacción, y recalcula en el servidor. Sin «use client»: lo usan la
// pantalla, la acción de crear y las pruebas.
import type { ReadingDraft, SaveLevelingPayload } from "@/app/(app)/projects/[id]/leveling/[pid]/actions";
import type { LibretaRow } from "@/lib/import/leveling";
import type {
  LevelingInput,
  LevelingProcess,
  LevelingReading,
  LevelingType,
  ReadingInput,
  RunType,
} from "@/types/leveling";
import { startRun } from "./armadas";

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

function inputOfRow(d: ReadingDraft): ReadingInput {
  return { ...d, distanceAccumulatedKm: null };
}

/**
 * La entrada del cálculo desde el borrador: la que usan la pantalla en vivo y
 * la cabecera. El orden no viaja: lo detecta `computeLevelingDetected`.
 */
export function levelingInputOf(draft: LevelingDraft): Omit<LevelingInput, "order" | "compensation"> {
  const { details: d, bm } = draft;
  return {
    type: d.type,
    startElevation: bm.startElevation,
    endElevation: d.type === "link" ? bm.endElevation : null,
    forward: draft.forward.map(inputOfRow),
    return: d.hasReturnRun ? draft.return.map(inputOfRow) : null,
  };
}

/**
 * El borrador con otro BM de partida (y de llegada). Las filas de los extremos
 * de cada recorrido que llevaban el código anterior lo cambian por el nuevo:
 * el comienzo de la ida y la llegada de la vuelta son el BM de partida, y en
 * la de enlace el fin de la ida y el comienzo de la vuelta, el de llegada.
 */
export function draftWithBm(draft: LevelingDraft, bm: LevelingBm): LevelingDraft {
  const renamed = (code: string) =>
    code === draft.bm.startCode ? bm.startCode : draft.bm.endCode != null && code === draft.bm.endCode ? (bm.endCode ?? code) : code;
  const ends = (rows: ReadingDraft[]) =>
    rows.map((row, i) => (i === 0 || i === rows.length - 1 ? { ...row, pointCode: renamed(row.pointCode) } : row));
  return { ...draft, bm, forward: ends(draft.forward), return: ends(draft.return) };
}

/**
 * Dónde empieza la vuelta: en el BM de partida (cerrada), en el de llegada
 * (enlace) o donde terminó la ida (abierta).
 */
export function returnStartCode(draft: LevelingDraft): string {
  if (draft.details.type === "closed") return draft.bm.startCode;
  if (draft.details.type === "link") return draft.bm.endCode ?? "";
  return draft.forward.at(-1)?.pointCode ?? draft.bm.startCode;
}

/** Las filas de un recorrido; uno vacío, solo con su punto de partida. */
export function runRowsOf(draft: LevelingDraft, run: RunType): ReadingDraft[] {
  const rows = draft[run];
  if (rows.length > 0) return rows;
  return startRun(run === "forward" ? draft.bm.startCode : returnStartCode(draft), "bm");
}

/** Lo que trae una importación del `.L` o del CSV (ver `LevelingImport`). */
export interface ImportedLibreta {
  type: LevelingType;
  startBm: { code: string; elevation: number | null };
  forward: LibretaRow[];
  return: LibretaRow[] | null;
}

const fromLibreta = (r: LibretaRow): ReadingDraft => ({
  ...r,
  backUpperM: null,
  backLowerM: null,
  foreUpperM: null,
  foreLowerM: null,
});

/**
 * El borrador con una importación: la libreta, el tipo, la vuelta y el BM de
 * partida que trae el archivo. Si el archivo no trae la cota del BM, se
 * conserva la que había.
 */
export function draftWithImport(draft: LevelingDraft, imported: ImportedLibreta): LevelingDraft {
  return {
    details: { ...draft.details, type: imported.type, hasReturnRun: imported.return != null },
    bm: {
      ...draft.bm,
      startCode: imported.startBm.code,
      startElevation: imported.startBm.elevation ?? draft.bm.startElevation,
    },
    forward: imported.forward.map(fromLibreta),
    return: (imported.return ?? []).map(fromLibreta),
  };
}
