import { describe, expect, it } from "vitest";
import { verdictFor } from "./closure-verdict";
import type { PolygonalResult } from "@/types/polygonal";

function resultWith(over: Partial<PolygonalResult>): PolygonalResult {
  return {
    angleSum: null,
    theoreticalSum: null,
    angularError: null,
    angularTolerance: null,
    anglesMeetTolerance: null,
    errorNorth: null,
    errorEast: null,
    linearError: null,
    perimeter: 0,
    relativePrecision: null,
    meetsLinearTolerance: null,
    meetsTolerance: null,
    stations: [],
    ...over,
  };
}

describe("verdictFor", () => {
  it("marca cumplimiento cuando la tolerancia se satisface", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: true, relativePrecision: 8000 }),
      "closed",
      "tercer_orden",
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
    expect(v.achieved).toBe("1:8.000");
  });

  it("marca incumplimiento cuando no alcanza la tolerancia", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: false, relativePrecision: 1001 }),
      "closed",
      "tercer_orden",
    );
    expect(v.tone).toBe("danger");
    expect(v.title).toBe("No cumple tercer orden");
    expect(v.achieved).toBe("1:1.001");
    expect(v.required).toBe("1:5.000");
  });

  it("marca cumplimiento con precisión infinita cuando el cierre es exacto", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: true, relativePrecision: Infinity }),
      "closed",
      "tercer_orden",
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
    expect(v.achieved).toBe("1:∞");
  });

  it("no exige cierre en poligonal abierta sin control", () => {
    const v = verdictFor(resultWith({}), "open_uncontrolled", "tercer_orden");
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Sin verificación de cierre");
    expect(v.achieved).toBeNull();
    expect(v.required).toBeNull();
  });

  it("señala datos incompletos cuando falta el cálculo", () => {
    const v = verdictFor(resultWith({}), "closed", "tercer_orden");
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Datos incompletos");
    expect(v.achieved).toBeNull();
    expect(v.required).toBeNull();
  });
});
