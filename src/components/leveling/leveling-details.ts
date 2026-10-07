// Lo que pide el alta de la nivelación y su validación (Fase 36, decisión 1).
// Sin «use client»: lo usan el popup y las pruebas.
import { parseNumber } from "@/lib/utils/parse";
import type { LevelingType } from "@/types/leveling";

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

/** Lee y valida el popup; un error en texto o los datos listos. */
export function validateLevelingDetails(
  form: LevelingDetailsForm,
): { error: string } | { details: LevelingDetails } {
  if (form.name.trim() === "") return { error: "El título es obligatorio." };
  if (form.startBmCode.trim() === "") return { error: "El código del BM de partida es obligatorio." };
  const start = parseNumber(form.startBmElevation);
  if (start == null) return { error: "La cota del BM de partida es obligatoria y debe ser un número." };
  let end: number | null = null;
  if (form.type === "link") {
    end = parseNumber(form.endBmElevation);
    if (form.endBmCode.trim() === "" || end == null) {
      return { error: "Una nivelación de enlace pide el código y la cota del BM de llegada." };
    }
  }
  return { details: { ...form, startBmElevation: start, endBmElevation: end } };
}

