// Tests de las capas de validación del proceso de nivelación (PRD § 5.1 y § 5.2).
//
// Nota de forma: el brief de esta tarea proponía un contrato `ValidationIssue[]`
// con `{ field, severity, message }`. Se descarta a favor del patrón ya usado
// en `polygonal.ts` (Fase 3): un `Record` por celda (`errors` / `warnings`
// indexados por campo), porque el editor pinta cada celda de la libreta según
// su propio estado y así se consulta directo (`issues.errors.backsight`) sin
// recorrer un array filtrando por `field`. Ver `leveling.ts` para el contrato
// completo (`ReadingCaptureIssues`, `hasReadingErrors`).

import { describe, expect, it } from "vitest";
import {
  evaluateLevelingClosure,
  hasReadingErrors,
  validateReadingCapture,
  validateRunCapture,
  validateSightBalances,
} from "./leveling";
import type { LevelingResult, ReadingInput } from "@/types/leveling";

// --- Ayudantes ---------------------------------------------------------------

function reading(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "PC-1",
    pointType: "pc",
    backsight: 1.5,
    foresight: 1.2,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    // Visuales normales de campo, equilibradas.
    backDistanceM: 40,
    foreDistanceM: 40,
    distanceAccumulatedKm: 0.1,
    ...over,
  };
}

/** Fila con todo a null salvo lo que el test ponga. */
function bare(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "P",
    pointType: "pc",
    backsight: null,
    foresight: null,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM: null,
    foreDistanceM: null,
    distanceAccumulatedKm: null,
    ...over,
  };
}

describe("validación de hilos", () => {
  it("hilos desordenados bloquean: HS debe ser mayor que HI", () => {
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.2, backLowerM: 1.5, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeDefined();
  });

  it("hilos iguales bloquean: la distancia sería cero", () => {
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.4, backLowerM: 1.4, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeDefined();
  });

  it("un par de hilos incompleto no bloquea", () => {
    // Sin los dos no hay orden que comprobar. La cartera de El Verjón trae
    // dos armadas así.
    const issues = validateReadingCapture(
      bare({ backUpperM: 1.5, backLowerM: null, backDistanceM: 30 }),
    );
    expect(issues.errors.backWires).toBeUndefined();
  });

  it("el hilo medio incoherente AVISA, no bloquea", () => {
    const issues = validateReadingCapture(
      bare({
        backsight: 1.5,
        backUpperM: 1.7,
        backLowerM: 1.2,
        backDistanceM: 50,
      }),
    );
    // (1.700 + 1.200)/2 = 1.450, difiere de 1.500 en 50 mm
    expect(issues.warnings.backsight).toBeDefined();
    expect(issues.errors.backsight).toBeUndefined();
  });

  it("el hilo medio dentro de tolerancia no avisa", () => {
    const issues = validateReadingCapture(
      bare({
        backsight: 1.4505,
        backUpperM: 1.7,
        backLowerM: 1.2,
        backDistanceM: 50,
      }),
    );
    expect(issues.warnings.backsight).toBeUndefined();
  });
});

describe("validación de distancia por visual", () => {
  it("bloquea si falta en un pc", () => {
    const issues = validateReadingCapture(
      bare({ pointType: "pc", backsight: 1.5, foresight: 1.2 }),
    );
    expect(issues.errors.backDistanceM).toBeDefined();
  });

  it("no bloquea en un intermedio", () => {
    const issues = validateReadingCapture(
      bare({ pointType: "intermediate", foresight: 1.2 }),
    );
    expect(issues.errors.foreDistanceM).toBeUndefined();
  });

  it("no exige distancia a una visual que no existe", () => {
    // La primera fila (bm) no lleva V−.
    const issues = validateReadingCapture(
      bare({ pointType: "bm", backsight: 1.5, backDistanceM: 30 }),
    );
    expect(issues.errors.foreDistanceM).toBeUndefined();
  });
});

describe("el equilibrado se evalúa en la ruta REAL de captura", () => {
  // En la Fase 9 la función del equilibrado existía, estaba probada y NO la
  // llamaba nadie: el criterio de aceptación 8 de la fase no se cumplía. Estos tests van por
  // validateRunCapture, que es la puerta por la que pasan las filas de verdad
  // (la usan el editor y el Server Action).
  const armada = (over: Partial<ReadingInput> = {}) => [
    bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5, backDistanceM: 30 }),
    bare({
      pointCode: "PC-1", pointType: "pc",
      foresight: 1.2, backsight: 2.0,
      foreDistanceM: 30, backDistanceM: 30,
      ...over,
    }),
    bare({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, foreDistanceM: 30 }),
  ];

  it("avisa del desequilibrio desde validateRunCapture", () => {
    // tercer_orden admite 4 m; aquí hay 20.
    const issues = validateRunCapture(
      armada({ backDistanceM: 40, foreDistanceM: 20 }),
      "closed",
      "tercer_orden",
      false,
    );
    expect(issues[1]?.warnings.sightBalance).toBeDefined();
  });

  it("no avisa cuando las visuales están equilibradas", () => {
    const issues = validateRunCapture(armada(), "closed", "tercer_orden", false);
    expect(issues[1]?.warnings.sightBalance).toBeUndefined();
  });

  it("no lo evalúa en un proceso reconstruido por el backfill", () => {
    const issues = validateRunCapture(
      armada({ backDistanceM: 40, foreDistanceM: 20 }),
      "closed",
      "tercer_orden",
      true,
    );
    expect(issues[1]?.warnings.sightBalance).toBeUndefined();
  });

  it("el aviso NO bloquea el guardado", () => {
    const issues = validateRunCapture(
      armada({ backDistanceM: 40, foreDistanceM: 20 }),
      "closed",
      "tercer_orden",
      false,
    );
    expect(hasReadingErrors(issues)).toBe(false);
  });
});

describe("equilibrado de visuales, por armada (Fase 19, N7)", () => {
  // Una armada es la V+ de un punto y la V− del siguiente punto que no sea
  // intermedio. Hasta la Fase 19 se comparaban la V+ y la V− de UNA MISMA fila,
  // que en un punto de cambio son de armadas distintas.
  const armada = (back: number, fore: number) => [
    bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5, backDistanceM: back }),
    bare({ pointCode: "BM-2", pointType: "bm", foresight: 1.2, foreDistanceM: fore }),
  ];

  it("avisa en la V− que cierra la armada, y la nombra", () => {
    // tercer_orden admite 4 m; aquí hay 20.
    const w = validateSightBalances(armada(40, 20), "tercer_orden", false);
    expect(w[0]).toBeUndefined();
    expect(w[1]).toBe(
      "Armada BM-1 → BM-2: visuales desequilibradas, 20.0 m de diferencia; el límite del orden es 4 m.",
    );
  });

  it("no avisa dentro del límite", () => {
    expect(validateSightBalances(armada(31.5, 28.5), "tercer_orden", false)).toEqual([undefined, undefined]);
  });

  it("NO evalúa en un proceso reconstruido por el backfill", () => {
    // Allí las distancias se repartieron por mitades: el equilibrado saldría
    // de un reparto inventado, un aviso (o un silencio) sin fundamento.
    expect(validateSightBalances(armada(40, 20), "tercer_orden", true)).toEqual([undefined, undefined]);
  });

  it("una intermedia no abre ni cierra armada", () => {
    const rows = [
      bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5, backDistanceM: 30 }),
      bare({ pointCode: "RAD", pointType: "intermediate", foresight: 1.0, foreDistanceM: 5 }),
      bare({ pointCode: "BM-2", pointType: "bm", foresight: 1.2, foreDistanceM: 29 }),
    ];
    expect(validateSightBalances(rows, "tercer_orden", false)).toEqual([undefined, undefined, undefined]);
  });

  it("sin la distancia de una de las dos visuales no se evalúa", () => {
    const rows = [
      bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.5 }),
      bare({ pointCode: "BM-2", pointType: "bm", foresight: 1.2, foreDistanceM: 29 }),
    ];
    expect(validateSightBalances(rows, "tercer_orden", false)).toEqual([undefined, undefined]);
  });

  it("la ida de El Verjón: avisa en C 2, C 3, C 4, C 7, D3 y C 8, no en C 1, C 5, C 6 ni D4", () => {
    // docs/carteras/TRABAJO NIVELACION EL VERJON-corregido.xlsx: la hoja de
    // campo calcula cada armada como V+ del punto i + V− del punto i+1
    // (M4 = I3 + K6…). La fila C 1 compara 28.1 con 28.5 y parecía equilibrada;
    // su armada con C 2 difiere 10.8 m.
    const rows: ReadingInput[] = [
      ["D1", "bm", 1.209, null, 31.5, null],
      ["C 1", "pc", 3.275, 0.268, 28.1, 28.5],
      ["C 2", "pc", 3.469, 0.224, 21.9, 17.3],
      ["C 3", "pc", 3.952, 0.092, 25.5, 11.7],
      ["AUX1", "intermediate", null, 0.194, null, null],
      ["C 4", "pc", 3.314, 0.244, 19.6, 15.1],
      ["C 5", "pc", 3.013, 0.124, 18.1, 16.6],
      ["C 6", "pc", 3.549, 0.145, 23.1, 15.5],
      ["C 7", "pc", 3.16, 0.132, 24.2, 14.9],
      ["D3", "pc", 2.395, 0.87, 14.7, 8.4],
      ["C 8", "pc", 2.349, 0.195, 12.1, 21.8],
      ["D4", "bm", null, 0.808, null, 15.7],
    ].map(([pointCode, pointType, backsight, foresight, backDistanceM, foreDistanceM]) =>
      bare({
        pointCode: pointCode as string,
        pointType: pointType as ReadingInput["pointType"],
        backsight: backsight as number | null,
        foresight: foresight as number | null,
        backDistanceM: backDistanceM as number | null,
        foreDistanceM: foreDistanceM as number | null,
      }),
    );
    const w = validateSightBalances(rows, "tercer_orden", false);
    const flagged = rows.filter((_, i) => w[i]).map((r) => r.pointCode);
    expect(flagged).toEqual(["C 2", "C 3", "C 4", "C 7", "D3", "C 8"]);
    expect(w[2]).toContain("Armada C 1 → C 2");
    expect(w[2]).toContain("10.8 m");
    expect(w[5]).toContain("Armada C 3 → C 4");
    expect(w[9]).toContain("Armada C 7 → D3");
    expect(w[9]).toContain("15.8 m");
  });
});

/** Resultado de cierre; por defecto todo cumple, cada caso altera lo que prueba. */
function resultWith(over: Partial<LevelingResult> = {}): LevelingResult {
  return {
    forward: { readings: [], heightDifference: 0, errorMm: null },
    return: null,
    arithmeticCheckOk: true,
    sumBacksights: 0,
    sumForesights: 0,
    closureErrorMm: 5,
    toleranceMm: 11.4,
    meetsTolerance: true,
    discrepancyMm: null,
    discrepancyToleranceMm: null,
    meetsDiscrepancy: null,
    adoptedHeightDifference: null,
    ...over,
  };
}

// --- Capa 1: validación en captura (§ 5.1) ------------------------------------

describe("validateReadingCapture — capa de captura (§ 5.1)", () => {
  it("acepta una lectura normal", () => {
    const issues = validateReadingCapture(reading());
    expect(issues.errors).toEqual({});
    expect(issues.warnings).toEqual({});
  });

  it("rechaza lectura de mira negativa", () => {
    const issues = validateReadingCapture(reading({ backsight: -0.1 }));
    expect(issues.errors.backsight).toBeDefined();
  });

  it("rechaza lectura de mira mayor que 4.000 m", () => {
    const issues = validateReadingCapture(reading({ foresight: 4.5 }));
    expect(issues.errors.foresight).toBeDefined();
  });

  it("advierte cuando V+ y V− son exactamente iguales", () => {
    const issues = validateReadingCapture(reading({ backsight: 1.5, foresight: 1.5 }));
    expect(issues.warnings.backsight ?? issues.warnings.foresight).toBeDefined();
    expect(issues.errors).toEqual({});
  });

  it("rechaza un punto sin código", () => {
    const issues = validateReadingCapture(reading({ pointCode: "" }));
    expect(issues.errors.pointCode).toBeDefined();
  });

  it("rechaza un punto con código en blanco (solo espacios)", () => {
    const issues = validateReadingCapture(reading({ pointCode: "   " }));
    expect(issues.errors.pointCode).toBeDefined();
  });

  it("exige distancia por visual en bm", () => {
    // Desde la Fase 9 el acumulado se DERIVA de las distancias por visual, así
    // que lo que hay que exigir es la distancia, no el acumulado.
    const issues = validateReadingCapture(
      reading({ pointType: "bm", backDistanceM: null, foreDistanceM: null }),
    );
    expect(issues.errors.backDistanceM).toBeDefined();
  });

  it("exige distancia por visual en pc", () => {
    // Sin ella el recorrido no acumula: la corrección proporcional trata el
    // punto como si estuviera en el origen y lo deja sin compensar, en
    // silencio, con el cierre reportando que cumple tolerancia y el error
    // intacto (medido en la Fase 4: 99.992 vs 100.000, con los −8 mm sin
    // corregir).
    const issues = validateReadingCapture(
      reading({ pointType: "pc", backDistanceM: null, foreDistanceM: null }),
    );
    expect(issues.errors.backDistanceM).toBeDefined();
    expect(issues.errors.foreDistanceM).toBeDefined();
  });

  it("no la exige en los puntos intermedios, que no se compensan", () => {
    const issues = validateReadingCapture(reading({
        pointType: "intermediate",
        backsight: null,
        backDistanceM: null,
        foreDistanceM: null,
      }));
    // Un intermedio no acumula, así que no exige distancia por visual.
    expect(issues.errors.foreDistanceM).toBeUndefined();
  });
});

describe("validateRunCapture — error posicional del BM inicial (§ 5.1)", () => {
  it("rechaza una fila bm inicial sin V+", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", backsight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc" }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(0)?.errors.backsight).toBeDefined();
  });

  it("no rechaza una fila bm final sin V+ (es lo correcto: cierra el recorrido)", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc" }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(2)?.errors.backsight).toBeUndefined();
  });

  it("acepta una fila bm inicial con V+ presente", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc" }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(0)?.errors.backsight).toBeUndefined();
  });

  it("conserva los demás errores de validateReadingCapture (p. ej. código vacío)", () => {
    const readings = [
      reading({ pointCode: "", pointType: "bm", backsight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "BM-2", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.5 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(0)?.errors.pointCode).toBeDefined();
    expect(issues.at(0)?.errors.backsight).toBeDefined();
  });
});

describe("validateRunCapture — la última fila de un recorrido que cierra debe ser bm (hallazgo 1)", () => {
  it("marca error si la última fila de un recorrido closed no es bm", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, backsight: 1.5, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: 1.5, distanceAccumulatedKm: 0.9 }),
      reading({ pointCode: "RAD-1", pointType: "intermediate", foresight: 0.805, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(2)?.errors.pointType).toBeDefined();
  });

  it("marca error si la última fila de un recorrido link no es bm", () => {
    const readings = [
      reading({ pointCode: "BM-A", pointType: "bm", foresight: null, backsight: 1.0, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "BM-B", pointType: "bm", foresight: 2.815, backsight: null, distanceAccumulatedKm: 2.2 }),
      reading({ pointCode: "RAD-1", pointType: "intermediate", foresight: 0.5, backsight: null, distanceAccumulatedKm: 2.2 }),
    ];
    const issues = validateRunCapture(readings, "link");
    expect(issues.at(2)?.errors.pointType).toBeDefined();
  });

  it("NO marca error en un recorrido open aunque la última fila no sea bm", () => {
    const readings = [
      reading({ pointCode: "BM-X", pointType: "bm", foresight: null, backsight: 1.325, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc", foresight: 0.876, backsight: 0.654, distanceAccumulatedKm: 0.08 }),
      reading({ pointCode: "PC-2", pointType: "intermediate", foresight: 1.987, backsight: null, distanceAccumulatedKm: 0.16 }),
    ];
    const issues = validateRunCapture(readings, "open");
    expect(issues.at(2)?.errors.pointType).toBeUndefined();
  });

  it("no marca error si la última fila ya es bm", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, backsight: 1.5, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.808, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(1)?.errors.pointType).toBeUndefined();
  });
});

describe("hasReadingErrors", () => {
  it("es false cuando ninguna fila tiene errores", () => {
    const issues = [
      validateReadingCapture(reading()),
      validateReadingCapture(reading({ pointCode: "PC-2" })),
    ];
    expect(hasReadingErrors(issues)).toBe(false);
  });

  it("es true si alguna fila tiene un error", () => {
    const issues = [
      validateReadingCapture(reading()),
      validateReadingCapture(reading({ pointCode: "" })),
    ];
    expect(hasReadingErrors(issues)).toBe(true);
  });

  it("una advertencia sola no cuenta como error", () => {
    const issues = [
      validateReadingCapture(reading({ backsight: 1.5, foresight: 1.5 })),
    ];
    expect(hasReadingErrors(issues)).toBe(false);
  });
});

// --- Capa 2: validación de cierre (§ 5.2) -------------------------------------

describe("evaluateLevelingClosure — capa de cierre (§ 5.2)", () => {
  it("no reporta nada cuando todo cumple", () => {
    const evaluation = evaluateLevelingClosure(resultWith());
    expect(evaluation.messages).toHaveLength(0);
    expect(evaluation.blocked).toBe(false);
    expect(evaluation.mustReject).toBe(false);
  });

  it("marca error crítico si la comprobación aritmética no cuadra", () => {
    const evaluation = evaluateLevelingClosure(
      resultWith({ arithmeticCheckOk: false }),
    );
    expect(evaluation.blocked).toBe(true);
    expect(evaluation.messages.length).toBeGreaterThan(0);
  });

  it("permite cerrar como rechazado si el cierre excede la tolerancia", () => {
    const evaluation = evaluateLevelingClosure(
      resultWith({ closureErrorMm: 20, meetsTolerance: false }),
    );
    expect(evaluation.blocked).toBe(false);
    expect(evaluation.canClose).toBe(true);
    expect(evaluation.mustReject).toBe(true);
  });

  it("advierte (no bloquea) si la discrepancia ida/vuelta excede T·√2", () => {
    const evaluation = evaluateLevelingClosure(
      resultWith({
        discrepancyMm: 22,
        discrepancyToleranceMm: 16.1,
        meetsDiscrepancy: false,
      }),
    );
    expect(evaluation.canClose).toBe(true);
    expect(evaluation.blocked).toBe(false);
    expect(evaluation.mustReject).toBe(false);
    expect(evaluation.messages.length).toBeGreaterThan(0);
  });
});
