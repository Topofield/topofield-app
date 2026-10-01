import { describe, expect, it } from "vitest";
import { calibrationOverdue, validateEquipmentItem, type EquipmentInput } from "./equipment";

// Fase 25: el catálogo de equipos valida lo que guarda, con las escalas de
// las columnas de los procesos, y avisa de una calibración de más de un año.

const TODAY = "2026-09-30";
const station = (over: Partial<EquipmentInput> = {}): EquipmentInput => ({
  kind: "total_station",
  brand: "Leica",
  model: "TS06 Plus",
  serial: "LCS-1",
  calibrationDate: "2026-03-01",
  angularPrecisionSeconds: 5,
  distancePrecisionMm: 1.5,
  distancePrecisionPpm: 2,
  levelType: null,
  kmPrecisionMm: null,
  ...over,
});
const level = (over: Partial<EquipmentInput> = {}): EquipmentInput => ({
  ...station(),
  kind: "level",
  brand: "Trimble",
  model: "DiNi 12",
  angularPrecisionSeconds: null,
  distancePrecisionMm: null,
  distancePrecisionPpm: null,
  levelType: "digital",
  kmPrecisionMm: 0.3,
  ...over,
});

describe("validateEquipmentItem", () => {
  it("una estación total y un nivel completos se guardan", () => {
    expect(validateEquipmentItem(station(), TODAY)).toEqual({});
    expect(validateEquipmentItem(level(), TODAY)).toEqual({});
  });

  it("marca o modelo, al menos uno", () => {
    expect(validateEquipmentItem(station({ brand: " ", model: null }), TODAY).name).toBe(
      "Indique la marca o el modelo.",
    );
    expect(validateEquipmentItem(station({ brand: null }), TODAY)).toEqual({});
  });

  it("la calibración no puede ser futura ni inválida", () => {
    expect(validateEquipmentItem(station({ calibrationDate: "2026-10-01" }), TODAY).calibrationDate).toBe(
      "La fecha de calibración no puede ser futura.",
    );
    expect(validateEquipmentItem(station({ calibrationDate: "2026-02-30" }), TODAY).calibrationDate).toBe(
      "La fecha de calibración no es válida.",
    );
    expect(validateEquipmentItem(station({ calibrationDate: TODAY }), TODAY)).toEqual({});
  });

  it("las precisiones caben en sus columnas", () => {
    expect(validateEquipmentItem(station({ angularPrecisionSeconds: 0 }), TODAY).angularPrecisionSeconds).toBe(
      "La precisión angular debe ser mayor que cero.",
    );
    expect(validateEquipmentItem(station({ angularPrecisionSeconds: 0.55 }), TODAY).angularPrecisionSeconds).toBe(
      "La precisión angular admite un decimal como mucho.",
    );
    expect(validateEquipmentItem(station({ distancePrecisionPpm: 0 }), TODAY)).toEqual({});
    expect(validateEquipmentItem(station({ distancePrecisionMm: -1 }), TODAY).distancePrecisionMm).toBe(
      "El término constante no puede ser negativo.",
    );
    expect(validateEquipmentItem(level({ kmPrecisionMm: 100 }), TODAY).kmPrecisionMm).toBe(
      "La desviación típica no puede superar 99.99.",
    );
    expect(validateEquipmentItem(level({ kmPrecisionMm: 0.305 }), TODAY).kmPrecisionMm).toBe(
      "La desviación típica admite 2 decimales como mucho.",
    );
  });

  it("solo mira los campos de su tipo", () => {
    expect(validateEquipmentItem(level({ angularPrecisionSeconds: -5 }), TODAY)).toEqual({});
    expect(validateEquipmentItem(level({ levelType: "laser" as never }), TODAY).levelType).toBe(
      "El tipo de nivel no es válido.",
    );
  });
});

describe("calibrationOverdue", () => {
  it("a más de 12 meses avisa; a 11, no", () => {
    expect(calibrationOverdue("2025-08-30", TODAY)).toBe(true);
    expect(calibrationOverdue("2025-10-30", TODAY)).toBe(false);
  });

  it("justo a los 12 meses todavía no", () => {
    expect(calibrationOverdue("2025-09-30", TODAY)).toBe(false);
    expect(calibrationOverdue("2025-09-29", TODAY)).toBe(true);
  });

  it("sin fecha, o con una inválida, no avisa", () => {
    expect(calibrationOverdue(null, TODAY)).toBe(false);
    expect(calibrationOverdue("", TODAY)).toBe(false);
    expect(calibrationOverdue("2025-02-30", TODAY)).toBe(false);
  });

  it("el 29 de febrero vence el 1 de marzo del año siguiente", () => {
    expect(calibrationOverdue("2024-02-29", "2025-03-01")).toBe(false);
    expect(calibrationOverdue("2024-02-29", "2025-03-02")).toBe(true);
  });
});
