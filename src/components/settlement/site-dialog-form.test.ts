import { describe, expect, it } from "vitest";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import { readSiteForm, thresholdsSummary } from "./site-dialog-form";

const base = {
  name: "Control de asentamiento estructural",
  description: "16 puntos de control amarrados al BM de la piscina.",
  structureType: "edificio" as const,
  thresholds: thresholdsFor("edificio"),
};

describe("el formulario del lugar (Fase 37)", () => {
  it("exige un nombre", () => {
    expect(readSiteForm({ ...base, name: "  " })).toEqual({ error: "El lugar necesita un nombre." });
  });

  it("los umbrales son crecientes: precaución < alerta < alarma", () => {
    const thresholds = { ...base.thresholds, accumulatedAlert: 20 };
    expect(readSiteForm({ ...base, thresholds })).toEqual({
      error: "Los umbrales de asentamiento acumulado deben ser crecientes: precaución < alerta < alarma.",
    });
  });

  it("un umbral debe ser positivo", () => {
    const thresholds = { ...base.thresholds, velocityCaution: 0 };
    expect(readSiteForm({ ...base, thresholds })).toEqual({
      error: "El umbral de precaución de velocidad debe ser un número positivo.",
    });
  });

  it("uno válido sale limpio, con la descripción vacía como null", () => {
    expect(readSiteForm({ ...base, name: " Torre ", description: " " })).toEqual({
      site: { name: "Torre", description: null, structureType: "edificio", thresholds: base.thresholds },
    });
  });

  it("el resumen de los umbrales plegados dice el tipo", () => {
    expect(thresholdsSummary(thresholdsFor("edificio"), "edificio")).toBe(
      "25 · 50 · 75 mm y 2 · 5 · 10 mm/mes, de edificio",
    );
    expect(thresholdsSummary({ ...thresholdsFor("edificio"), accumulatedCaution: 20 }, "edificio")).toBe(
      "20 · 50 · 75 mm y 2 · 5 · 10 mm/mes",
    );
  });
});
