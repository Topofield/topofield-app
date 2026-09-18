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
    reorientationError: null,
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
      true,
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
    expect(v.achieved).toBe("1:8.000");
    expect(v.caveat).toBeNull();
  });

  it("marca incumplimiento cuando no alcanza la tolerancia", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: false, relativePrecision: 1001 }),
      "closed",
      "tercer_orden",
      true,
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
      true,
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple tercer orden");
    expect(v.achieved).toBe("1:∞");
  });

  it("no exige cierre en poligonal abierta sin control", () => {
    const v = verdictFor(
      resultWith({}),
      "open_uncontrolled",
      "tercer_orden",
      true,
    );
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Sin verificación de cierre");
    expect(v.achieved).toBeNull();
    expect(v.required).toBeNull();
  });

  it("señala datos incompletos cuando falta el cálculo", () => {
    const v = verdictFor(resultWith({}), "closed", "tercer_orden", true);
    expect(v.tone).toBe("neutral");
    expect(v.title).toBe("Datos incompletos");
    expect(v.achieved).toBeNull();
    expect(v.required).toBeNull();
  });
});

// El verde es la afirmación más fuerte de la aplicación y sale de un único
// estadístico de cierre. Con un equipo que no da para el orden declarado
// —una estación de 5″ contra primer orden, K = 1″— el veredicto sigue siendo
// verde (es un enunciado sobre las MEDIDAS, y es cierto), pero acota su
// alcance. El cálculo no cambia: `tone`, `title` y `meets_tolerance` siguen
// siendo lo que eran.
describe("verdictFor — matiz de equipo insuficiente", () => {
  it("matiza el verde cuando el instrumento no alcanza el orden", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: true, relativePrecision: Infinity }),
      "closed",
      "primer_orden",
      false,
    );
    expect(v.tone).toBe("ok");
    expect(v.title).toBe("Cumple primer orden");
    expect(v.caveat).toBe(
      "El cierre cumple, pero el equipo declarado no alcanza el orden declarado (K = 1″): el veredicto es sobre las medidas, no sobre la capacidad del instrumento.",
    );
  });

  it("no matiza cuando el instrumento sí alcanza el orden", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: true, relativePrecision: Infinity }),
      "closed",
      "primer_orden",
      true,
    );
    expect(v.caveat).toBeNull();
  });

  it("no matiza el veredicto rojo: ahí ya no hay afirmación que acotar", () => {
    const v = verdictFor(
      resultWith({ meetsTolerance: false, relativePrecision: 1001 }),
      "closed",
      "primer_orden",
      false,
    );
    expect(v.tone).toBe("danger");
    expect(v.caveat).toBeNull();
  });

  it("no matiza la poligonal abierta sin control, que no afirma cierre", () => {
    const v = verdictFor(
      resultWith({}),
      "open_uncontrolled",
      "primer_orden",
      false,
    );
    expect(v.tone).toBe("neutral");
    expect(v.caveat).toBeNull();
  });
});

describe("verdictFor — control de reorientación", () => {
  it("una reorientación mala no cambia el veredicto de cierre", () => {
    // La reorientación es control de calidad del levantamiento, no criterio de
    // tolerancia: un proceso que cumple ángulo y cierre sigue siendo apto.
    const bueno = resultWith({
      anglesMeetTolerance: true,
      meetsLinearTolerance: true,
      meetsTolerance: true,
      reorientationError: 0.2,
    });
    const conDeriva = resultWith({
      anglesMeetTolerance: true,
      meetsLinearTolerance: true,
      meetsTolerance: true,
      reorientationError: 45,
    });
    expect(verdictFor(conDeriva, "closed", "tercer_orden", true)).toEqual(
      verdictFor(bueno, "closed", "tercer_orden", true),
    );
  });
});
