import { describe, it, expect } from "vitest";
import { computeRun } from "./leveling";
import type { PointType, ReadingInput } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  distanceAccumulatedKm: number | null,
): ReadingInput {
  return {
    pointCode,
    pointType,
    backsight,
    foresight,
    distanceM: null,
    distanceAccumulatedKm,
  };
}

// Fixture verificado a mano. Circuito cerrado de 0.900 km que sale del BM-1
// (cota 100.000) y regresa a él con un error deliberado de −8.0 mm.
//   ΣL.At = 4.500 · ΣL.Ad = 4.508 · diferencia = −0.008 = Δcota. Cuadra.
const CLOSED_RUN: ReadingInput[] = [
  r("BM-1", "bm", 1.5, null, 0.0),
  r("PC-1", "pc", 2.0, 1.2, 0.3),
  r("PC-2", "pc", 1.0, 2.5, 0.6),
  r("BM-1", "bm", null, 0.808, 0.9),
];

describe("computeRun — cálculo base", () => {
  const run = computeRun(CLOSED_RUN, 100.0);

  it("calcula la AI solo en las filas con lectura atrás", () => {
    expect(run.readings.map((x) => x.instrumentHeight)).toEqual([
      101.5, 102.3, 100.8, null,
    ]);
  });

  it("consume la AI anterior antes de generar la nueva", () => {
    // PC-1: cota = AI(BM-1) 101.5 − L.Ad 1.2 = 100.3
    //       y SOLO DESPUÉS AI = 100.3 + 2.0 = 102.3
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.instrumentHeight).toBeCloseTo(102.3, 6);
  });

  it("encadena las cotas del recorrido", () => {
    // La última cota (100.8 − 0.808) no es representable exacto en binario
    // (da 99.99199999999999 en IEEE-754), así que esa posición se compara con
    // toBeCloseTo en vez de toEqual. El valor esperado sigue siendo 99.992.
    const elevations = run.readings.map((x) => x.elevationCalculated);
    expect(elevations.slice(0, 3)).toEqual([100.0, 100.3, 99.8]);
    expect(elevations[3]).toBeCloseTo(99.992, 6);
  });

  it("calcula el desnivel de la sección", () => {
    expect(run.heightDifference).toBeCloseTo(-0.008, 6);
  });

  it("cuadra la comprobación aritmética ΣLA − ΣLD = Δcota", () => {
    expect(run.sumBacksights).toBeCloseTo(4.5, 6);
    expect(run.sumForesights).toBeCloseTo(4.508, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — puntos intermedios", () => {
  // Un intermedio cuelga de la AI vigente y NO la actualiza.
  const withIntermediate: ReadingInput[] = [
    r("BM-1", "bm", 1.5, null, 0.0),
    r("A", "intermediate", null, 1.1, 0.1),
    r("PC-1", "pc", 2.0, 1.2, 0.3),
    r("BM-2", "bm", null, 2.5, 0.6),
  ];
  const run = computeRun(withIntermediate, 100.0);

  it("calcula la cota del intermedio contra la AI vigente", () => {
    // AI vigente = 101.5 → cota A = 101.5 − 1.1 = 100.4
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.4, 6);
  });

  it("no deja que el intermedio genere AI ni propague cota", () => {
    expect(run.readings[1]?.instrumentHeight).toBeNull();
    // PC-1 sigue colgando de la AI del BM-1, no de la del intermedio.
    expect(run.readings[2]?.elevationCalculated).toBeCloseTo(100.3, 6);
  });

  it("excluye los intermedios de la comprobación aritmética", () => {
    // ΣLA = 1.5 + 2.0 = 3.5 (el intermedio no aporta L.At, y su L.Ad se ignora)
    // ΣLD = 1.2 + 2.5 = 3.7 → diferencia −0.2 = 99.8 − 100.0. Cuadra.
    expect(run.sumBacksights).toBeCloseTo(3.5, 6);
    expect(run.sumForesights).toBeCloseTo(3.7, 6);
    expect(run.arithmeticCheckOk).toBe(true);
  });
});

describe("computeRun — el orden consumir → generar", () => {
  // Este es el test que protege contra el error más difícil de ver a ojo:
  // invertir el orden dentro de la fila desplaza TODAS las cotas del recorrido
  // de forma coherente, así que el resultado sigue pareciendo plausible.
  it("no usa la L.At de la propia fila para calcular su cota", () => {
    const run = computeRun(
      [
        r("BM-1", "bm", 1.5, null, 0.0),
        // Si la implementación generase la AI antes de consumirla, la cota de
        // PC-1 saldría de 100.0 + 1.5 + 2.0 − 1.2, no de 101.5 − 1.2.
        r("PC-1", "pc", 2.0, 1.2, 0.3),
      ],
      100.0,
    );
    expect(run.readings[1]?.elevationCalculated).toBeCloseTo(100.3, 6);
    expect(run.readings[1]?.elevationCalculated).not.toBeCloseTo(102.3, 6);
  });

  it("deja la primera fila en la cota de partida, sin L.Ad que consumir", () => {
    const run = computeRun([r("BM-1", "bm", 1.5, null, 0.0)], 100.0);
    expect(run.readings[0]?.elevationCalculated).toBeCloseTo(100.0, 6);
    expect(run.readings[0]?.instrumentHeight).toBeCloseTo(101.5, 6);
    expect(run.heightDifference).toBeCloseTo(0, 6);
  });
});
