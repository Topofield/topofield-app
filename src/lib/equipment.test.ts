import { describe, expect, it } from "vitest";
import {
  equipmentInputFromLevel,
  equipmentInputFromTotalStation,
  equipmentLabel,
  equipmentPrecisionLabel,
  equipmentRowOf,
  levelFieldsOf,
  sameInstrument,
  totalStationFieldsOf,
} from "./equipment";
import type { Equipment } from "@/types/equipment";

// Fase 25: el catálogo rellena los formularios con una copia de sus valores,
// y lo tecleado vuelve al catálogo con solo los campos de su tipo.

const base: Equipment = {
  id: "e1",
  user_id: "u1",
  kind: "total_station",
  brand: "Leica",
  model: "TS06 Plus",
  serial: "LCS-1",
  calibration_date: "2026-03-01",
  angular_precision_seconds: 5,
  distance_precision_mm: 1.5,
  distance_precision_ppm: 2,
  level_type: null,
  km_precision_mm: null,
  created_at: "",
  updated_at: "",
};

describe("del catálogo al formulario y de vuelta", () => {
  it("una estación total rellena todos sus campos", () => {
    expect(totalStationFieldsOf(base)).toEqual({
      equipmentBrand: "Leica",
      equipmentModel: "TS06 Plus",
      equipmentSerial: "LCS-1",
      equipmentCalibrationDate: "2026-03-01",
      angularPrecisionSeconds: "5",
      distancePrecisionMm: "1.5",
      distancePrecisionPpm: "2",
    });
    expect(equipmentInputFromTotalStation(totalStationFieldsOf(base))).toMatchObject({
      kind: "total_station",
      brand: "Leica",
      angularPrecisionSeconds: 5,
      distancePrecisionMm: 1.5,
    });
  });

  it("un nivel, con su tipo y su desviación; vacíos como nulos", () => {
    const nivel: Equipment = {
      ...base,
      kind: "level",
      brand: "Trimble",
      model: "DiNi 12",
      serial: null,
      calibration_date: null,
      angular_precision_seconds: null,
      distance_precision_mm: null,
      distance_precision_ppm: null,
      level_type: "digital",
      km_precision_mm: 0.3,
    };
    const fields = levelFieldsOf(nivel);
    expect(fields).toMatchObject({ equipmentSerial: "", levelType: "digital", kmPrecisionMm: "0.3" });
    expect(equipmentInputFromLevel(fields)).toMatchObject({
      kind: "level",
      serial: null,
      calibrationDate: null,
      levelType: "digital",
      kmPrecisionMm: 0.3,
    });
  });

  it("acepta coma decimal, como el resto de los formularios", () => {
    const input = equipmentInputFromTotalStation({ ...totalStationFieldsOf(base), distancePrecisionMm: "1,5" });
    expect(input.distancePrecisionMm).toBe(1.5);
  });

  it("la fila guarda solo los campos del tipo", () => {
    const row = equipmentRowOf({ ...equipmentInputFromTotalStation(totalStationFieldsOf(base)), kmPrecisionMm: 3 });
    expect(row.km_precision_mm).toBeNull();
    expect(row.angular_precision_seconds).toBe(5);
  });
});

describe("equipmentLabel y sameInstrument", () => {
  it("marca, modelo y serie", () => {
    expect(equipmentLabel(base)).toBe("Leica TS06 Plus · s/n LCS-1");
    expect(equipmentLabel({ brand: "Leica", model: null, serial: null })).toBe("Leica");
  });

  it("el mismo aparato sin distinguir mayúsculas ni espacios", () => {
    expect(sameInstrument(base, { brand: " leica", model: "ts06 plus ", serial: "lcs-1" })).toBe(true);
    expect(sameInstrument(base, { brand: "Leica", model: "TS06 Plus", serial: "LCS-2" })).toBe(false);
    expect(sameInstrument({ brand: "Leica", model: null, serial: null }, { brand: "Leica", model: "", serial: " " })).toBe(true);
  });
});

describe("equipmentPrecisionLabel", () => {
  it("estación total y nivel", () => {
    expect(equipmentPrecisionLabel(base)).toBe("5″ · 1.5 mm + 2 ppm");
    expect(
      equipmentPrecisionLabel({ ...base, kind: "level", level_type: "digital", km_precision_mm: 0.3 }),
    ).toBe("0.30 mm/km · Digital / electrónico");
  });

  it("sin datos de precisión", () => {
    expect(
      equipmentPrecisionLabel({
        ...base,
        angular_precision_seconds: null,
        distance_precision_mm: null,
        distance_precision_ppm: null,
      }),
    ).toBe("—");
  });
});
