import { describe, expect, it } from "vitest";
import type { LevelingResult } from "@/types/leveling";
import { levelingVerdictFor } from "./leveling-verdict";

// Fase 22: el veredicto de la nivelación, arriba de la pantalla.

const base: LevelingResult = {
  forward: { readings: [], heightDifference: 0, errorMm: null },
  return: null,
  arithmeticCheckOk: true,
  sumBacksights: 0,
  sumForesights: 0,
  closureErrorMm: null,
  toleranceMm: null,
  meetsTolerance: null,
  discrepancyMm: null,
  discrepancyToleranceMm: null,
  meetsDiscrepancy: null,
  adoptedHeightDifference: null,
};

describe("levelingVerdictFor", () => {
  it("una cerrada se juzga por su cierre: el tramo 2, −0.4 mm sobre 1.397 km", () => {
    const v = levelingVerdictFor(
      { ...base, closureErrorMm: -0.4, toleranceMm: 14.2, meetsTolerance: true },
      "closed",
      "tercer_orden",
      1.397288,
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
    expect(v.value).toBe("-0.4 mm");
    expect(v.required).toBe("tolerancia ±14.2 mm");
    expect(v.detail).toBe("Error de cierre sobre 1.397 km");
  });

  it("fuera de tolerancia: no cumple", () => {
    const v = levelingVerdictFor(
      { ...base, closureErrorMm: 20, toleranceMm: 12, meetsTolerance: false },
      "link",
      "segundo_orden",
      1,
    );
    expect(v.tone).toBe("danger");
    expect(v.title).toBe("No cumple segundo orden");
  });

  it("una abierta con vuelta se juzga por la discrepancia: El Verjón, 5.0 mm", () => {
    const v = levelingVerdictFor(
      {
        ...base,
        return: { readings: [], heightDifference: 0, errorMm: null },
        discrepancyMm: 5,
        discrepancyToleranceMm: 10.5,
        meetsDiscrepancy: true,
      },
      "open",
      "tercer_orden",
      0.384,
    );
    expect(v.tone).toBe("ok");
    expect(v.value).toBe("5.0 mm");
    expect(v.detail).toBe("Discrepancia entre ida y vuelta");
  });

  it("abierta sin vuelta: sin verificación; cerrada sin datos: incompletos", () => {
    expect(levelingVerdictFor(base, "open", "tercer_orden", 0).title).toBe(
      "Sin verificación de cierre",
    );
    expect(levelingVerdictFor(base, "closed", "tercer_orden", 0).title).toBe("Datos incompletos");
  });
});
