import { describe, expect, it } from "vitest";
import { detailsNotices, EMPTY_LEVELING_DETAILS, validateLevelingBm, validateLevelingDetails } from "./leveling-details";

const base = { ...EMPTY_LEVELING_DETAILS, name: "El Verjón", startBmCode: "D1", startBmElevation: "3288.5" };

describe("validateLevelingDetails", () => {
  it("pide el título", () => {
    expect(validateLevelingDetails({ ...base, name: "  " })).toEqual({ error: "El título es obligatorio." });
  });

  it("lee la cota con coma decimal", () => {
    const r = validateLevelingDetails({ ...base, startBmElevation: "3288,5000" });
    expect("details" in r && r.details.startBmElevation).toBe(3288.5);
  });

  it("la de enlace pide el BM de llegada con su cota", () => {
    expect(validateLevelingDetails({ ...base, type: "link" })).toEqual({
      error: "Una nivelación de enlace pide el código y la cota del BM de llegada.",
    });
    const r = validateLevelingDetails({ ...base, type: "link", endBmCode: "D4", endBmElevation: "3315.0855" });
    expect("details" in r && r.details.endBmElevation).toBe(3315.0855);
  });

  it("la abierta no guarda BM de llegada", () => {
    const r = validateLevelingDetails({ ...base, type: "open", endBmCode: "D4", endBmElevation: "1" });
    expect("details" in r && r.details.endBmElevation).toBeNull();
  });
});

describe("validateLevelingBm (el popup del BM)", () => {
  const bm = { type: "open" as const, startBmCode: " D1 ", startBmElevation: "3288,5", endBmCode: "", endBmElevation: "" };

  it("lee el código sin espacios y la cota con coma", () => {
    expect(validateLevelingBm(bm)).toEqual({
      bm: { startCode: "D1", startElevation: 3288.5, endCode: null, endElevation: null },
    });
  });

  it("pide el código y la cota del BM de partida", () => {
    expect(validateLevelingBm({ ...bm, startBmCode: "" })).toEqual({
      error: "El código del BM de partida es obligatorio.",
    });
    expect(validateLevelingBm({ ...bm, startBmElevation: "x" })).toEqual({
      error: "La cota del BM de partida es obligatoria y debe ser un número.",
    });
  });

  it("en la de enlace, también el de llegada", () => {
    expect("error" in validateLevelingBm({ ...bm, type: "link" })).toBe(true);
    expect(validateLevelingBm({ ...bm, type: "link", endBmCode: "D4", endBmElevation: "3315.0855" })).toEqual({
      bm: { startCode: "D1", startElevation: 3288.5, endCode: "D4", endElevation: 3315.0855 },
    });
  });
});

describe("los avisos de Editar datos", () => {
  const initial = { ...base, type: "open" as const, hasReturnRun: true };

  it("quitar la vuelta avisa que se borra su libreta", () => {
    expect(detailsNotices(initial, { ...initial, hasReturnRun: false }, { hasReadings: true, returnArmadas: 10 })).toContain(
      "Sin vuelta se borra la libreta de la vuelta: 10 armadas.",
    );
    expect(detailsNotices(initial, { ...initial, hasReturnRun: false }, { hasReadings: true, returnArmadas: 0 })).toEqual([]);
  });

  it("cambiar el tipo o un BM avisa que se recalcula la libreta", () => {
    expect(detailsNotices(initial, { ...initial, type: "closed" }, { hasReadings: true, returnArmadas: 0 })).toEqual([
      "Cambiar el tipo o un BM recalcula la libreta.",
    ]);
    expect(detailsNotices(initial, { ...initial, startBmElevation: "3290" }, { hasReadings: false, returnArmadas: 0 })).toEqual([]);
  });
});
