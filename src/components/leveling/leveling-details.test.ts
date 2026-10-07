import { describe, expect, it } from "vitest";
import { EMPTY_LEVELING_DETAILS, validateLevelingDetails } from "./leveling-details";

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
