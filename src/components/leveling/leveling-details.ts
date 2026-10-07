// Lo que pide el alta de la nivelación y su validación (Fase 36, decisión 1).
// Sin «use client»: lo usan el popup y las pruebas.
import { parseNumber } from "@/lib/utils/parse";
import type { LevelingType } from "@/types/leveling";
import type { LevelingBm } from "./leveling-save";

/** Lo que el alta pide (Fase 36, decisión 1), como se teclea. */
export interface LevelingDetailsForm {
  name: string;
  type: LevelingType;
  hasReturnRun: boolean;
  startBmCode: string;
  startBmElevation: string;
  endBmCode: string;
  endBmElevation: string;
  location: string;
  responsibleName: string;
  responsibleRole: string;
  equipmentBrand: string;
  equipmentModel: string;
  equipmentSerial: string;
}

export const EMPTY_LEVELING_DETAILS: LevelingDetailsForm = {
  name: "",
  type: "closed",
  hasReturnRun: false,
  startBmCode: "",
  startBmElevation: "",
  endBmCode: "",
  endBmElevation: "",
  location: "",
  responsibleName: "",
  responsibleRole: "",
  equipmentBrand: "",
  equipmentModel: "",
  equipmentSerial: "",
};

/** Lo validado del popup: los números ya leídos. */
export interface LevelingDetails extends Omit<LevelingDetailsForm, "startBmElevation" | "endBmElevation"> {
  startBmElevation: number;
  endBmElevation: number | null;
}

type BmForm = Pick<LevelingDetailsForm, "type" | "startBmCode" | "startBmElevation" | "endBmCode" | "endBmElevation">;

/**
 * Lee y valida el BM de partida y, en la de enlace, el de llegada: los pide el
 * alta y el popup del BM de la libreta.
 */
export function validateLevelingBm(form: BmForm): { error: string } | { bm: LevelingBm } {
  if (form.startBmCode.trim() === "") return { error: "El código del BM de partida es obligatorio." };
  const start = parseNumber(form.startBmElevation);
  if (start == null) return { error: "La cota del BM de partida es obligatoria y debe ser un número." };
  if (form.type !== "link") {
    return { bm: { startCode: form.startBmCode.trim(), startElevation: start, endCode: null, endElevation: null } };
  }
  const end = parseNumber(form.endBmElevation);
  if (form.endBmCode.trim() === "" || end == null) {
    return { error: "Una nivelación de enlace pide el código y la cota del BM de llegada." };
  }
  return {
    bm: { startCode: form.startBmCode.trim(), startElevation: start, endCode: form.endBmCode.trim(), endElevation: end },
  };
}

/** Lee y valida el popup; un error en texto o los datos listos. */
export function validateLevelingDetails(
  form: LevelingDetailsForm,
): { error: string } | { details: LevelingDetails } {
  if (form.name.trim() === "") return { error: "El título es obligatorio." };
  const read = validateLevelingBm(form);
  if ("error" in read) return read;
  return { details: { ...form, startBmElevation: read.bm.startElevation, endBmElevation: read.bm.endElevation } };
}

