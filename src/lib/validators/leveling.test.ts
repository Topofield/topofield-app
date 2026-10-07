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
import { CARTERA_VERJON, type LecturaCartera } from "@/lib/demo/carteras";
import {
  findIncompleteTurningPoint,
  hasReadingErrors,
  turningPointBlocker,
  validateReadingCapture,
  validateRunCapture,
} from "./leveling";
import type { ReadingInput } from "@/types/leveling";

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

describe("validateRunCapture — sin equilibrado de visuales (Fase 36)", () => {
  it("una armada de 31.5 m atrás y 8.4 m adelante no avisa", () => {
    const rows = [
      bare({ pointCode: "D1", pointType: "bm", backsight: 1.209, backDistanceM: 31.5 }),
      bare({ pointCode: "C 1", pointType: "pc", foresight: 0.268, foreDistanceM: 8.4 }),
    ];
    const issues = validateRunCapture(rows, "open");
    expect(issues.every((i) => Object.keys(i.warnings).length === 0)).toBe(true);
  });

  it("la ida de El Verjón, con 53.3 m más atrás que adelante, no avisa", () => {
    const issues = validateRunCapture(deCartera(CARTERA_VERJON.ida), "open");
    expect(issues.every((i) => Object.keys(i.warnings).length === 0)).toBe(true);
    expect(hasReadingErrors(issues)).toBe(false);
  });
});

/** Las filas de una cartera de campo como lecturas del validador. */
function deCartera(lecturas: LecturaCartera[]): ReadingInput[] {
  return lecturas.map((r) =>
    bare({
      pointCode: r.code,
      pointType: r.type,
      backsight: r.backsight,
      foresight: r.foresight,
      backDistanceM: r.backDistanceM,
      foreDistanceM: r.foreDistanceM,
    }),
  );
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

  it("con allowUnfinished (la nivelación, Fase 36), una cerrada a medias no es un error", () => {
    const readings = [
      reading({ pointCode: "BM-1", pointType: "bm", foresight: null, backsight: 1.5 }),
      reading({ pointCode: "PC-1", pointType: "pc", foresight: 0.8, backsight: null }),
    ];
    expect(validateRunCapture(readings, "closed").at(1)?.errors.pointType).toBeDefined();
    expect(validateRunCapture(readings, "closed", { allowUnfinished: true }).at(1)?.errors.pointType).toBeUndefined();
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

describe("punto de cambio incompleto (Fase 24)", () => {
  const bmStart = bare({ pointCode: "BM-1", pointType: "bm", backsight: 1.4, backDistanceM: 30 });
  const bmEnd = bare({ pointCode: "BM-1", pointType: "bm", foresight: 1.3, foreDistanceM: 30 });
  const pcSinFore = bare({ pointCode: "PC-1", backsight: 1.5, backDistanceM: 30 });
  const pcSinBack = bare({ pointCode: "PC-1", foresight: 1.2, foreDistanceM: 30 });
  const pcCompleto = reading();
  // Las filas del resultado del motor son `ComputedReading`: la regla solo
  // mira tipo y lecturas.
  const run = (rows: ReadingInput[]) => ({
    readings: rows as never,
    heightDifference: 0,
    distanceKm: 0,
    errorMm: null,
    toleranceMm: null,
    meetsTolerance: null,
    arithmeticCheckOk: true,
  });

  it("encuentra el PC sin V− o sin V+, con su fila", () => {
    expect(findIncompleteTurningPoint([bmStart, pcCompleto, pcSinFore, bmEnd])).toEqual({
      row: 3,
      missing: "V−",
    });
    expect(findIncompleteTurningPoint([bmStart, pcSinBack, bmEnd])).toEqual({
      row: 2,
      missing: "V+",
    });
  });

  it("una fila vacía, la primera, la última y lo que no es PC no cuentan", () => {
    expect(findIncompleteTurningPoint([bmStart, bare(), bmEnd])).toBeNull();
    expect(findIncompleteTurningPoint([pcSinFore, pcCompleto, pcSinBack])).toBeNull();
    expect(
      findIncompleteTurningPoint([bmStart, bare({ pointType: "intermediate", foresight: 1.1 }), bmEnd]),
    ).toBeNull();
  });

  it("la celda avisa, sin bloquear el guardado", () => {
    const issues = validateRunCapture([bmStart, pcSinFore, bmEnd], "closed");
    expect(issues[1]!.warnings.foresight).toBe("Falta la V−: el punto de cambio no cierra su armada.");
    expect(hasReadingErrors(issues)).toBe(false);
    const otra = validateRunCapture([bmStart, pcSinBack, bmEnd], "closed");
    expect(otra[1]!.warnings.backsight).toBe("Falta la V+: el punto de cambio no abre la armada siguiente.");
  });

  it("sin aviso en una fila recién agregada", () => {
    const issues = validateRunCapture([bmStart, bare(), bmEnd], "closed");
    expect(issues[1]!.warnings.foresight).toBeUndefined();
    expect(issues[1]!.warnings.backsight).toBeUndefined();
  });

  it("nombra la fila del punto de cambio incompleto", () => {
    expect(turningPointBlocker({ forward: run([bmStart, pcSinFore, bmEnd]), return: null })).toBe(
      "El punto de cambio de la fila 2 no tiene V−: sin ella la libreta no encadena y no se puede cerrar.",
    );
  });

  it("revisa también la vuelta, que no pasa por la comprobación aritmética", () => {
    expect(
      turningPointBlocker({ forward: run([bmStart, pcCompleto, bmEnd]), return: run([bmStart, pcSinBack, bmEnd]) }),
    ).toBe(
      "El punto de cambio de la fila 2 de la vuelta no tiene V+: sin ella la libreta no encadena y no se puede cerrar.",
    );
  });

  it("con todo completo no dice nada", () => {
    expect(
      turningPointBlocker({ forward: run([bmStart, pcCompleto, bmEnd]), return: null }),
    ).toBeNull();
  });
});

// --- Fase 26 — correcciones del cálculo ---------------------------------------

describe("validateReadingCapture — distancias por visual (Fase 26, C-11)", () => {
  it("una distancia en cero o negativa es error de captura", () => {
    const negativa = validateReadingCapture(
      bare({ pointType: "pc", backsight: 1.2, backDistanceM: -50, foresight: 1.1, foreDistanceM: 30 }),
    );
    expect(negativa.errors.backDistanceM).toBe("La distancia debe ser mayor que cero.");
    const cero = validateReadingCapture(
      bare({ pointType: "pc", backsight: 1.2, backDistanceM: 30, foresight: 1.1, foreDistanceM: 0 }),
    );
    expect(cero.errors.foreDistanceM).toBe("La distancia debe ser mayor que cero.");
  });
});
