// Del catálogo de equipos a los campos de los formularios, y al revés (Fase 25).
//
// Sin «use client»: lo usan la página del catálogo, los formularios de equipo
// de los tres módulos y las Server Actions. El catálogo es una plantilla: lo
// que pasa de aquí a un proceso es una copia de los valores.

import { parseNumber } from "@/lib/utils/parse";
import type { EquipmentInput } from "@/lib/validators/equipment";
import type { Equipment } from "@/types/equipment";
import { LEVEL_TYPE_LABELS, type LevelFields, type TotalStationFields } from "@/types/project";

/** Un número de la base como texto del formulario: vacío si no hay. */
const text = (value: number | string | null | undefined) =>
  value == null ? "" : String(value);

/** Los campos de estación total que rellena un equipo del catálogo. */
export function totalStationFieldsOf(equipment: Equipment): TotalStationFields {
  return {
    equipmentBrand: equipment.brand ?? "",
    equipmentModel: equipment.model ?? "",
    equipmentSerial: equipment.serial ?? "",
    equipmentCalibrationDate: equipment.calibration_date ?? "",
    angularPrecisionSeconds: text(equipment.angular_precision_seconds),
    distancePrecisionMm: text(equipment.distance_precision_mm),
    distancePrecisionPpm: text(equipment.distance_precision_ppm),
  };
}

/** Los campos de nivel que rellena un equipo del catálogo. */
export function levelFieldsOf(equipment: Equipment): LevelFields {
  return {
    equipmentBrand: equipment.brand ?? "",
    equipmentModel: equipment.model ?? "",
    equipmentSerial: equipment.serial ?? "",
    equipmentCalibrationDate: equipment.calibration_date ?? "",
    levelType: equipment.level_type ?? "",
    kmPrecisionMm: text(equipment.km_precision_mm),
  };
}

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/** Lo tecleado en un formulario de estación total, como equipo del catálogo. */
export function equipmentInputFromTotalStation(fields: TotalStationFields): EquipmentInput {
  return {
    kind: "total_station",
    brand: orNull(fields.equipmentBrand),
    model: orNull(fields.equipmentModel),
    serial: orNull(fields.equipmentSerial),
    calibrationDate: orNull(fields.equipmentCalibrationDate),
    angularPrecisionSeconds: parseNumber(fields.angularPrecisionSeconds),
    distancePrecisionMm: parseNumber(fields.distancePrecisionMm),
    distancePrecisionPpm: parseNumber(fields.distancePrecisionPpm),
    levelType: null,
    kmPrecisionMm: null,
  };
}

/** Lo tecleado en un formulario de nivel, como equipo del catálogo. */
export function equipmentInputFromLevel(fields: LevelFields): EquipmentInput {
  return {
    kind: "level",
    brand: orNull(fields.equipmentBrand),
    model: orNull(fields.equipmentModel),
    serial: orNull(fields.equipmentSerial),
    calibrationDate: orNull(fields.equipmentCalibrationDate),
    angularPrecisionSeconds: null,
    distancePrecisionMm: null,
    distancePrecisionPpm: null,
    levelType: fields.levelType === "" ? null : fields.levelType,
    kmPrecisionMm: parseNumber(fields.kmPrecisionMm),
  };
}

/** Las columnas de `equipment` de un equipo validado; las del otro tipo, nulas. */
export function equipmentRowOf(input: EquipmentInput) {
  const station = input.kind === "total_station";
  return {
    kind: input.kind,
    brand: input.brand,
    model: input.model,
    serial: input.serial,
    calibration_date: input.calibrationDate,
    angular_precision_seconds: station ? input.angularPrecisionSeconds : null,
    distance_precision_mm: station ? input.distancePrecisionMm : null,
    distance_precision_ppm: station ? input.distancePrecisionPpm : null,
    level_type: station ? null : input.levelType,
    km_precision_mm: station ? null : input.kmPrecisionMm,
  };
}

/** «Leica TS06 Plus · s/n LCS-1», para listas y selectores. */
export function equipmentLabel(equipment: Pick<Equipment, "brand" | "model" | "serial">): string {
  const name = [equipment.brand, equipment.model].filter((v) => v && v.trim() !== "").join(" ");
  return equipment.serial ? `${name} · s/n ${equipment.serial}` : name;
}

const key = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * ¿Son el mismo aparato? Misma marca, modelo y serie, sin distinguir
 * mayúsculas ni espacios de los extremos: la regla del índice único de
 * `equipment` (decisión 4 del PRD).
 */
export function sameInstrument(
  a: { brand: string | null; model: string | null; serial: string | null },
  b: { brand: string | null; model: string | null; serial: string | null },
): boolean {
  return key(a.brand) === key(b.brand) && key(a.model) === key(b.model) && key(a.serial) === key(b.serial);
}

/** «5″ · 1.5 mm + 2 ppm» o «0.30 mm/km · Digital / electrónico»; «—» sin datos. */
export function equipmentPrecisionLabel(equipment: Equipment): string {
  const parts: string[] = [];
  if (equipment.kind === "total_station") {
    if (equipment.angular_precision_seconds != null) parts.push(`${equipment.angular_precision_seconds}″`);
    const mm = equipment.distance_precision_mm;
    const ppm = equipment.distance_precision_ppm;
    if (mm != null || ppm != null) parts.push(`${mm ?? 0} mm + ${ppm ?? 0} ppm`);
  } else {
    if (equipment.km_precision_mm != null) parts.push(`${Number(equipment.km_precision_mm).toFixed(2)} mm/km`);
    if (equipment.level_type) parts.push(LEVEL_TYPE_LABELS[equipment.level_type]);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
