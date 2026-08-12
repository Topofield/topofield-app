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
} from "./leveling";
import type { LevelingResult, ReadingInput } from "@/types/leveling";

// --- Ayudantes ---------------------------------------------------------------

function reading(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "PC-1",
    pointType: "pc",
    backsight: 1.5,
    foresight: 1.2,
    distanceM: 40, // visual normal de campo
    distanceAccumulatedKm: 0.1,
    ...over,
  };
}

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

  it("advierte cuando L.At y L.Ad son exactamente iguales", () => {
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

  it("exige distancia acumulada en bm", () => {
    const issues = validateReadingCapture(reading({ pointType: "bm", distanceAccumulatedKm: null }));
    expect(issues.errors.distanceAccumulatedKm).toBeDefined();
  });

  it("exige distancia acumulada en pc", () => {
    // Sin ella la corrección proporcional trata el punto como si estuviera en
    // el origen y lo deja sin compensar, en silencio: el cierre reporta que
    // cumple tolerancia con el error real intacto (medido: 99.992 vs 100.000
    // esperado, con los −8 mm sin corregir).
    const issues = validateReadingCapture(reading({ pointType: "pc", distanceAccumulatedKm: null }));
    expect(issues.errors.distanceAccumulatedKm).toBeDefined();
  });

  it("no la exige en los puntos intermedios, que no se compensan", () => {
    const issues = validateReadingCapture(reading({
        pointType: "intermediate",
        backsight: null,
        distanceAccumulatedKm: null,
      }));
    expect(issues.errors.distanceAccumulatedKm).toBeUndefined();
  });
});

describe("validateRunCapture — error posicional del BM inicial (§ 5.1)", () => {
  it("rechaza una fila bm inicial sin lectura atrás", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", backsight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc" }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(0)?.errors.backsight).toBeDefined();
  });

  it("no rechaza una fila bm final sin lectura atrás (es lo correcto: cierra el recorrido)", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, distanceAccumulatedKm: 0 }),
      reading({ pointCode: "PC-1", pointType: "pc" }),
      reading({ pointCode: "BM-1", pointType: "bm", foresight: 0.8, backsight: null, distanceAccumulatedKm: 0.9 }),
    ];
    const issues = validateRunCapture(readings, "closed");
    expect(issues.at(2)?.errors.backsight).toBeUndefined();
  });

  it("acepta una fila bm inicial con lectura atrás presente", () => {
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
