// Tests de las capas de validación del proceso poligonal (PRD § 5.1 y § 5.2).
//
// La capa de cierre (`evaluatePolygonalClosure`) es la regla de negocio central
// del § 4.6: decide si un levantamiento puede cerrarse y con qué desenlace. El
// cierre es irreversible y la aplicación lo trata como inmutable, así que estos
// tests cubren la matriz completa de estados por tipo de poligonal.

import { describe, expect, it } from "vitest";
import {
  evaluatePolygonalClosure,
  expectStationCapture,
  hasCaptureErrors,
  validatePolygonalStation,
  type CaptureIssues,
} from "./polygonal";
import type { PolygonalResult, StationResult } from "@/types/polygonal";

// --- Ayudantes ---------------------------------------------------------------

/** Estación de captura; por defecto válida, se altera lo que cada caso pruebe. */
function capture(over: Partial<Parameters<typeof validatePolygonalStation>[0]> = {}) {
  return {
    pointCode: "E-1",
    angleDeg: 90,
    angleMin: 0,
    angleSec: 0,
    distance: 100,
    ...over,
  };
}

const EXPECT_BOTH = { angle: true, distance: true };

/** Resultado de cálculo; por defecto sin datos, cada caso puebla lo que prueba. */
function resultWith(over: Partial<PolygonalResult> = {}): PolygonalResult {
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

/** Estación ya calculada, con coordenadas resueltas. */
function computedStation(north: number | null): StationResult {
  return {
    pointCode: "E1",
    correctedAngle: null,
    azimuth: null,
    deltaNorth: null,
    deltaEast: null,
    correctedDeltaNorth: null,
    correctedDeltaEast: null,
    north,
    east: north,
  };
}

// --- Capa 1: validación de captura (§ 5.1) -----------------------------------

// `expectStationCapture` es la fuente de verdad COMPARTIDA entre el editor y
// `savePolygonalProcessAction`: decide qué celdas son obligatorias en cada
// estación. Si se desviara, el servidor y la pantalla dejarían de estar de
// acuerdo sobre qué es captura parcial legítima y qué es un error, sin que
// nada lo delatara. Estos tests la fijan.
describe("expectStationCapture", () => {
  it("exige ángulo y distancia en TODAS las estaciones de una cerrada", () => {
    for (const i of [0, 1, 4]) {
      expect(expectStationCapture("closed", i, 5)).toEqual({
        angle: true,
        distance: true,
      });
    }
  });

  it("en una abierta, la primera estación no lleva ángulo pero sí distancia", () => {
    expect(expectStationCapture("open_controlled", 0, 4)).toEqual({
      angle: false,
      distance: true,
    });
    expect(expectStationCapture("open_uncontrolled", 0, 4)).toEqual({
      angle: false,
      distance: true,
    });
  });

  it("en una abierta, la última estación no lleva ángulo ni distancia", () => {
    expect(expectStationCapture("open_controlled", 3, 4)).toEqual({
      angle: false,
      distance: false,
    });
  });

  it("en una abierta, las intermedias llevan ambas", () => {
    expect(expectStationCapture("open_controlled", 1, 4)).toEqual({
      angle: true,
      distance: true,
    });
    expect(expectStationCapture("open_controlled", 2, 4)).toEqual({
      angle: true,
      distance: true,
    });
  });

  // Caso límite real: una abierta recién creada con una sola estación. El
  // índice 0 es a la vez primero y último; gana la regla del primero, porque
  // se evalúa antes. Se fija para que un refactor no la invierta en silencio.
  it("con una sola estación abierta, aplica la regla de la primera", () => {
    expect(expectStationCapture("open_controlled", 0, 1)).toEqual({
      angle: false,
      distance: true,
    });
  });

  it("una cerrada de una sola estación sigue exigiendo ambas", () => {
    expect(expectStationCapture("closed", 0, 1)).toEqual({
      angle: true,
      distance: true,
    });
  });
});

describe("validatePolygonalStation — código de punto", () => {
  // El validador de nivelación exige el código desde la Fase 4
  // (`validateReadingCapture`); el de poligonal no lo hacía, así que una
  // estación sin código se persistía igual en cliente y servidor, contra una
  // columna `point_code text not null`.
  it("exige el código del punto", () => {
    const r = validatePolygonalStation(capture({ pointCode: "" }), EXPECT_BOTH);
    expect(r.errors.pointCode).toBe("El punto necesita un código.");
  });

  it("trata el código en blanco como ausente", () => {
    const r = validatePolygonalStation(
      capture({ pointCode: "   " }),
      EXPECT_BOTH,
    );
    expect(r.errors.pointCode).toBe("El punto necesita un código.");
  });

  it("acepta un código con espacios alrededor", () => {
    const r = validatePolygonalStation(
      capture({ pointCode: " E-1 " }),
      EXPECT_BOTH,
    );
    expect(r.errors.pointCode).toBeUndefined();
  });

  // El código es obligatorio SIEMPRE, también en la última estación de una
  // abierta, que no lleva ángulo ni distancia: sin ángulo ni distancia sigue
  // siendo un punto del levantamiento y necesita identificarse.
  it("lo exige incluso donde no se exigen ángulo ni distancia", () => {
    const r = validatePolygonalStation(capture({ pointCode: "" }), {
      angle: false,
      distance: false,
    });
    expect(r.errors.pointCode).toBe("El punto necesita un código.");
  });
});


describe("validatePolygonalStation — distancia", () => {
  it("acepta una distancia normal", () => {
    const r = validatePolygonalStation(capture(), EXPECT_BOTH);
    expect(r.errors.distance).toBeUndefined();
  });

  it("exige la distancia cuando la estación la requiere", () => {
    const r = validatePolygonalStation(capture({ distance: null }), EXPECT_BOTH);
    expect(r.errors.distance).toBe("La distancia es obligatoria.");
  });

  it("no exige la distancia cuando la estación no la requiere", () => {
    const r = validatePolygonalStation(capture({ distance: null }), {
      angle: true,
      distance: false,
    });
    expect(r.errors.distance).toBeUndefined();
  });

  it("rechaza una distancia de cero", () => {
    const r = validatePolygonalStation(capture({ distance: 0 }), EXPECT_BOTH);
    expect(r.errors.distance).toBe("La distancia debe ser mayor que cero.");
  });

  it("rechaza una distancia negativa", () => {
    const r = validatePolygonalStation(capture({ distance: -5 }), EXPECT_BOTH);
    expect(r.errors.distance).toBe("La distancia debe ser mayor que cero.");
  });

  it("rechaza una distancia mayor que 1000 m", () => {
    const r = validatePolygonalStation(capture({ distance: 1000.1 }), EXPECT_BOTH);
    expect(r.errors.distance).toBe("La distancia no puede superar los 1000 m.");
  });

  it("acepta exactamente 1000 m, que es el límite", () => {
    const r = validatePolygonalStation(capture({ distance: 1000 }), EXPECT_BOTH);
    expect(r.errors.distance).toBeUndefined();
  });
});

describe("validatePolygonalStation — ángulo", () => {
  it("exige el ángulo cuando la estación lo requiere", () => {
    const r = validatePolygonalStation(capture({ angleDeg: null }), EXPECT_BOTH);
    expect(r.errors.angle).toBe("El ángulo es obligatorio.");
  });

  it("no exige el ángulo cuando la estación no lo requiere", () => {
    const r = validatePolygonalStation(capture({ angleDeg: null }), {
      angle: false,
      distance: true,
    });
    expect(r.errors.angle).toBeUndefined();
  });

  it("considera incompleto un ángulo al que le falta un componente", () => {
    const r = validatePolygonalStation(capture({ angleSec: null }), EXPECT_BOTH);
    expect(r.errors.angle).toBe("El ángulo es obligatorio.");
  });

  it("rechaza minutos fuera de rango", () => {
    const r = validatePolygonalStation(capture({ angleMin: 60 }), EXPECT_BOTH);
    expect(r.errors.angle).toBe("Los minutos deben estar entre 0 y 59.");
  });

  it("rechaza segundos fuera de rango", () => {
    const r = validatePolygonalStation(capture({ angleSec: 60 }), EXPECT_BOTH);
    expect(r.errors.angle).toBe("Los segundos deben estar entre 0 y 59.");
  });

  it("advierte, sin bloquear, ante un ángulo de 0°", () => {
    const r = validatePolygonalStation(capture({ angleDeg: 0 }), EXPECT_BOTH);
    expect(r.errors.angle).toBeUndefined();
    expect(r.warnings.angle).toBe("Ángulo de 0° o 360°: posible error de captura.");
  });

  it("advierte, sin bloquear, ante un ángulo de 360°", () => {
    const r = validatePolygonalStation(capture({ angleDeg: 360 }), EXPECT_BOTH);
    expect(r.errors.angle).toBeUndefined();
    expect(r.warnings.angle).toBe("Ángulo de 0° o 360°: posible error de captura.");
  });

  it("no advierte ante 0° si los minutos o segundos no son cero", () => {
    const r = validatePolygonalStation(capture({ angleDeg: 0, angleMin: 30 }), EXPECT_BOTH);
    expect(r.warnings.angle).toBeUndefined();
  });
});

describe("hasCaptureErrors", () => {
  it("es falso cuando no hay issues", () => {
    expect(hasCaptureErrors([])).toBe(false);
  });

  it("es falso cuando solo hay advertencias", () => {
    const issues: CaptureIssues[] = [{ errors: {}, warnings: { angle: "ojo" } }];
    expect(hasCaptureErrors(issues)).toBe(false);
  });

  it("es verdadero si alguna estación tiene un error", () => {
    const issues: CaptureIssues[] = [
      { errors: {}, warnings: {} },
      { errors: { distance: "falta" }, warnings: {} },
    ];
    expect(hasCaptureErrors(issues)).toBe(true);
  });
});

// --- Capa 2: validación de cierre (§ 5.2) ------------------------------------

describe("evaluatePolygonalClosure — errores de captura", () => {
  it("bloquea el cierre de cualquier tipo si hay errores de captura", () => {
    for (const type of ["closed", "open_controlled", "open_uncontrolled"] as const) {
      const r = evaluatePolygonalClosure(type, resultWith(), true);
      expect(r.blocked).toBe(true);
      expect(r.canClose).toBe(false);
      expect(r.mustReject).toBe(false);
      expect(r.messages[0]).toContain("errores de captura");
    }
  });
});

describe("evaluatePolygonalClosure — poligonal cerrada", () => {
  it("permite el cierre cuando cumple ambas tolerancias", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: true, meetsLinearTolerance: true }),
      false,
    );
    expect(r).toEqual({
      canClose: true,
      mustReject: false,
      blocked: false,
      messages: [],
    });
  });

  it("bloquea el cierre si el error angular supera la tolerancia (§ 5.2)", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: false, meetsLinearTolerance: true }),
      false,
    );
    expect(r.blocked).toBe(true);
    expect(r.canClose).toBe(false);
    expect(r.messages[0]).toContain("error angular");
  });

  it("prioriza el fallo angular cuando ambas tolerancias fallan", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: false, meetsLinearTolerance: false }),
      false,
    );
    // El error angular bloquea del todo; no degrada a "rechazable".
    expect(r.blocked).toBe(true);
    expect(r.mustReject).toBe(false);
  });

  it("solo admite cierre como rechazado si la precisión relativa no alcanza (§ 5.2)", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: true, meetsLinearTolerance: false }),
      false,
    );
    expect(r.canClose).toBe(true);
    expect(r.mustReject).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.messages[0]).toContain("precisión relativa");
  });

  it("bloquea el cierre mientras falte el cálculo angular", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: null, meetsLinearTolerance: true }),
      false,
    );
    expect(r.blocked).toBe(true);
    expect(r.messages[0]).toContain("Completa los datos");
  });

  it("bloquea el cierre mientras falte el cálculo lineal", () => {
    const r = evaluatePolygonalClosure(
      "closed",
      resultWith({ anglesMeetTolerance: true, meetsLinearTolerance: null }),
      false,
    );
    expect(r.blocked).toBe(true);
    expect(r.messages[0]).toContain("Completa los datos");
  });
});

describe("evaluatePolygonalClosure — abierta con control", () => {
  it("permite el cierre cuando el cierre contra el punto conocido cumple", () => {
    const r = evaluatePolygonalClosure(
      "open_controlled",
      resultWith({ meetsLinearTolerance: true }),
      false,
    );
    expect(r).toEqual({
      canClose: true,
      mustReject: false,
      blocked: false,
      messages: [],
    });
  });

  it("solo admite cierre como rechazado si no alcanza la tolerancia", () => {
    const r = evaluatePolygonalClosure(
      "open_controlled",
      resultWith({ meetsLinearTolerance: false }),
      false,
    );
    expect(r.canClose).toBe(true);
    expect(r.mustReject).toBe(true);
    expect(r.messages[0]).toContain("punto conocido");
  });

  it("bloquea el cierre mientras falte el punto de llegada", () => {
    const r = evaluatePolygonalClosure(
      "open_controlled",
      resultWith({ meetsLinearTolerance: null }),
      false,
    );
    expect(r.blocked).toBe(true);
    expect(r.messages[0]).toContain("punto de llegada");
  });

  it("no exige verificación angular, a diferencia de la cerrada", () => {
    // anglesMeetTolerance en false no debe bloquear: la abierta con control se
    // verifica contra el punto de llegada, no por suma de ángulos.
    const r = evaluatePolygonalClosure(
      "open_controlled",
      resultWith({ anglesMeetTolerance: false, meetsLinearTolerance: true }),
      false,
    );
    expect(r.canClose).toBe(true);
    expect(r.blocked).toBe(false);
  });
});

describe("evaluatePolygonalClosure — abierta sin control", () => {
  it("permite el cierre cuando todas las estaciones tienen coordenadas", () => {
    const r = evaluatePolygonalClosure(
      "open_uncontrolled",
      resultWith({ stations: [computedStation(100), computedStation(200)] }),
      false,
    );
    expect(r).toEqual({
      canClose: true,
      mustReject: false,
      blocked: false,
      messages: [],
    });
  });

  it("bloquea el cierre si alguna estación quedó sin calcular", () => {
    const r = evaluatePolygonalClosure(
      "open_uncontrolled",
      resultWith({ stations: [computedStation(100), computedStation(null)] }),
      false,
    );
    expect(r.blocked).toBe(true);
    expect(r.messages[0]).toContain("todas las estaciones");
  });

  it("bloquea el cierre si no hay estaciones", () => {
    const r = evaluatePolygonalClosure("open_uncontrolled", resultWith(), false);
    expect(r.blocked).toBe(true);
  });

  it("nunca exige rechazo: no tiene cierre que verificar", () => {
    // Sin punto de llegada no hay tolerancia lineal que evaluar, así que este
    // tipo jamás debe degradar a "solo rechazable".
    const r = evaluatePolygonalClosure(
      "open_uncontrolled",
      resultWith({
        meetsLinearTolerance: false,
        stations: [computedStation(100)],
      }),
      false,
    );
    expect(r.mustReject).toBe(false);
    expect(r.canClose).toBe(true);
  });
});
