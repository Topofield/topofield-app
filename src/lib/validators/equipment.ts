// Validación de un equipo del catálogo y aviso de calibración (Fase 25).

import { CALIBRATION_MAX_MONTHS } from "@/lib/calculations/tolerances";
import { isCalendarDate } from "@/lib/validators/settlement";
import { LEVEL_TYPES, type LevelType } from "@/types/project";
import type { EquipmentKind } from "@/types/equipment";

/** Lo que el formulario del catálogo manda, ya leído a números. */
export interface EquipmentInput {
  kind: EquipmentKind;
  brand: string | null;
  model: string | null;
  serial: string | null;
  /** `YYYY-MM-DD`. */
  calibrationDate: string | null;
  angularPrecisionSeconds: number | null;
  distancePrecisionMm: number | null;
  distancePrecisionPpm: number | null;
  levelType: LevelType | null;
  kmPrecisionMm: number | null;
}

export type EquipmentErrors = Partial<
  Record<
    | "name"
    | "calibrationDate"
    | "angularPrecisionSeconds"
    | "distancePrecisionMm"
    | "distancePrecisionPpm"
    | "levelType"
    | "kmPrecisionMm",
    string
  >
>;

/** ¿Tiene `value` como mucho `decimals` decimales? Con holgura de coma flotante. */
function fitsScale(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

/**
 * Un número que tiene que caber en una columna `decimal(p, s)`: positivo (o
 * no negativo), por debajo del máximo y con `s` decimales como mucho. Las
 * columnas son las de los procesos, para que copiar el equipo nunca falle.
 */
function precisionError(
  value: number | null,
  {
    max,
    decimals,
    allowZero,
    label,
    feminine,
  }: { max: number; decimals: number; allowZero: boolean; label: string; feminine: boolean },
): string | undefined {
  if (value == null) return undefined;
  if (!Number.isFinite(value)) return `${label}: no es un número.`;
  if (allowZero ? value < 0 : value <= 0) {
    return allowZero
      ? `${label} no puede ser ${feminine ? "negativa" : "negativo"}.`
      : `${label} debe ser mayor que cero.`;
  }
  if (value > max) return `${label} no puede superar ${max}.`;
  if (!fitsScale(value, decimals)) {
    return `${label} admite ${decimals === 1 ? "un decimal" : `${decimals} decimales`} como mucho.`;
  }
  return undefined;
}

/**
 * Valida un equipo del catálogo. `today` es la fecha de hoy en Bogotá
 * (`YYYY-MM-DD`): una calibración no puede ser futura. Devuelve los errores
 * por campo; vacío si se puede guardar. Solo mira los campos del tipo: la
 * acción guarda los del otro como nulos.
 */
export function validateEquipmentItem(input: EquipmentInput, today: string): EquipmentErrors {
  const errors: EquipmentErrors = {};
  const blank = (v: string | null) => v == null || v.trim() === "";
  if (blank(input.brand) && blank(input.model)) {
    errors.name = "Indique la marca o el modelo.";
  }
  if (input.calibrationDate != null && input.calibrationDate !== "") {
    if (!isCalendarDate(input.calibrationDate)) {
      errors.calibrationDate = "La fecha de calibración no es válida.";
    } else if (input.calibrationDate > today) {
      errors.calibrationDate = "La fecha de calibración no puede ser futura.";
    }
  }
  const set = (key: keyof EquipmentErrors, message: string | undefined) => {
    if (message) errors[key] = message;
  };
  if (input.kind === "total_station") {
    set("angularPrecisionSeconds", precisionError(input.angularPrecisionSeconds, {
      max: 9999.9, decimals: 1, allowZero: false, label: "La precisión angular", feminine: true,
    }));
    set("distancePrecisionMm", precisionError(input.distancePrecisionMm, {
      max: 999.9, decimals: 1, allowZero: true, label: "El término constante", feminine: false,
    }));
    set("distancePrecisionPpm", precisionError(input.distancePrecisionPpm, {
      max: 999.9, decimals: 1, allowZero: true, label: "El término proporcional", feminine: false,
    }));
  } else {
    if (input.levelType != null && !LEVEL_TYPES.includes(input.levelType)) {
      errors.levelType = "El tipo de nivel no es válido.";
    }
    set("kmPrecisionMm", precisionError(input.kmPrecisionMm, {
      max: 99.99, decimals: 2, allowZero: false, label: "La desviación típica", feminine: true,
    }));
  }
  return errors;
}

/**
 * ¿Tiene la calibración más de `CALIBRATION_MAX_MONTHS` meses a la fecha de
 * referencia (Fase 25)? La referencia es la fecha de la visita en
 * asentamientos y hoy en poligonal y nivelación, que no guardan fecha de
 * medición. Sin fecha de calibración, o con una no válida, no avisa.
 */
export function calibrationOverdue(calibrationDate: string | null, referenceDate: string): boolean {
  if (!calibrationDate || !isCalendarDate(calibrationDate) || !isCalendarDate(referenceDate)) {
    return false;
  }
  const [y, m, d] = calibrationDate.split("-").map(Number) as [number, number, number];
  // Mismo día, `CALIBRATION_MAX_MONTHS` meses después; `Date.UTC` resuelve el
  // 29 de febrero y los meses cortos llevándolos al mes siguiente.
  const limit = new Date(Date.UTC(y, m - 1 + CALIBRATION_MAX_MONTHS, d)).toISOString().slice(0, 10);
  return referenceDate > limit;
}
