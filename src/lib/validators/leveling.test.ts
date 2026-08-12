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
} from "./leveling";
import type { LevelingResult, ReadingInput } from "@/types/leveling";

// --- Ayudantes ---------------------------------------------------------------

function reading(over: Partial<ReadingInput> = {}): ReadingInput {
  return {
    pointCode: "PC-1",
    pointType: "pc",
    backsight: 1.5,
    foresight: 1.2,
    // Dentro del límite de equilibrado incluso del orden más exigente
    // (primer_orden: 2 m), para que el fixture "normal" no dispare la
    // advertencia de equilibrado de visuales por defecto.
    distanceM: 1.5,
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
    const issues = validateReadingCapture(reading(), "tercer_orden");
    expect(issues.errors).toEqual({});
    expect(issues.warnings).toEqual({});
  });

  it("rechaza lectura de mira negativa", () => {
    const issues = validateReadingCapture(
      reading({ backsight: -0.1 }),
      "tercer_orden",
    );
    expect(issues.errors.backsight).toBeDefined();
  });

  it("rechaza lectura de mira mayor que 4.000 m", () => {
    const issues = validateReadingCapture(
      reading({ foresight: 4.5 }),
      "tercer_orden",
    );
    expect(issues.errors.foresight).toBeDefined();
  });

  it("advierte cuando L.At y L.Ad son exactamente iguales", () => {
    const issues = validateReadingCapture(
      reading({ backsight: 1.5, foresight: 1.5 }),
      "tercer_orden",
    );
    expect(issues.warnings.backsight ?? issues.warnings.foresight).toBeDefined();
    expect(issues.errors).toEqual({});
  });

  it("rechaza un punto sin código", () => {
    const issues = validateReadingCapture(
      reading({ pointCode: "" }),
      "tercer_orden",
    );
    expect(issues.errors.pointCode).toBeDefined();
  });

  it("rechaza un punto con código en blanco (solo espacios)", () => {
    const issues = validateReadingCapture(
      reading({ pointCode: "   " }),
      "tercer_orden",
    );
    expect(issues.errors.pointCode).toBeDefined();
  });

  it("exige distancia acumulada en bm", () => {
    const issues = validateReadingCapture(
      reading({ pointType: "bm", distanceAccumulatedKm: null }),
      "tercer_orden",
    );
    expect(issues.errors.distanceAccumulatedKm).toBeDefined();
  });

  it("exige distancia acumulada en pc", () => {
    // Sin ella la corrección proporcional trata el punto como si estuviera en
    // el origen y lo deja sin compensar, en silencio: el cierre reporta que
    // cumple tolerancia con el error real intacto (medido: 99.992 vs 100.000
    // esperado, con los −8 mm sin corregir).
    const issues = validateReadingCapture(
      reading({ pointType: "pc", distanceAccumulatedKm: null }),
      "tercer_orden",
    );
    expect(issues.errors.distanceAccumulatedKm).toBeDefined();
  });

  it("no la exige en los puntos intermedios, que no se compensan", () => {
    const issues = validateReadingCapture(
      reading({
        pointType: "intermediate",
        backsight: null,
        distanceAccumulatedKm: null,
      }),
      "tercer_orden",
    );
    expect(issues.errors.distanceAccumulatedKm).toBeUndefined();
  });

  it("advierte cuando el desequilibrio de visuales supera el límite del orden", () => {
    // La lectura no separa distancia de visual atrás y adelante: se toma
    // `distanceM` como la distancia de la visual de esta fila (ver comentario
    // en la implementación) y se compara contra el límite del orden.
    const issues = validateReadingCapture(
      reading({ distanceM: 50 }),
      "primer_orden", // límite 2 m
    );
    expect(issues.warnings.sightBalance).toBeDefined();
    expect(issues.errors).toEqual({});
  });

  it("no advierte desequilibrio de visuales dentro del límite del orden", () => {
    const issues = validateReadingCapture(reading({ distanceM: 5 }), "ordinario"); // límite 6 m
    expect(issues.warnings.sightBalance).toBeUndefined();
  });
});

describe("hasReadingErrors", () => {
  it("es false cuando ninguna fila tiene errores", () => {
    const issues = [
      validateReadingCapture(reading(), "tercer_orden"),
      validateReadingCapture(reading({ pointCode: "PC-2" }), "tercer_orden"),
    ];
    expect(hasReadingErrors(issues)).toBe(false);
  });

  it("es true si alguna fila tiene un error", () => {
    const issues = [
      validateReadingCapture(reading(), "tercer_orden"),
      validateReadingCapture(reading({ pointCode: "" }), "tercer_orden"),
    ];
    expect(hasReadingErrors(issues)).toBe(true);
  });

  it("una advertencia sola no cuenta como error", () => {
    const issues = [
      validateReadingCapture(
        reading({ backsight: 1.5, foresight: 1.5 }),
        "tercer_orden",
      ),
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
