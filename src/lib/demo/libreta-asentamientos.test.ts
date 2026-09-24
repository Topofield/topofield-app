import { describe, expect, it } from "vitest";
import { generateVisitBook } from "./libreta-asentamientos";
import {
  bookRowInputOf,
  computeVisitBook,
  deriveControlElevations,
} from "@/lib/calculations/settlement-book";
import { validateVisitBook } from "@/lib/validators/settlement-book";
import type { PointInput } from "@/types/settlement";

const TARGETS = [
  { code: "PC-01", elevation: 100.5921 },
  { code: "PC-02", elevation: 100.5648 },
  { code: "PC-03", elevation: 100.5043 },
  { code: "PC-04", elevation: 100.4787 },
  { code: "PC-05", elevation: 100.4389 },
  { code: "PC-06", elevation: 100.4972 },
  { code: "PC-07", elevation: 100.5353 },
  { code: "PC-08", elevation: 100.5832 },
];

const POINTS: PointInput[] = TARGETS.map((t) => ({
  id: t.code,
  code: t.code,
  northing: null,
  easting: null,
  initialElevation: null,
  activeFrom: null,
  retiredOn: null,
}));

function run(closureMm: number, amarre = { code: "BM-1", elevation: 100 }, seed = 7) {
  const rows = generateVisitBook({ amarre, targets: TARGETS, closureMm, order: "tercer_orden", seed });
  const inputs = rows.map(bookRowInputOf);
  const check = validateVisitBook(inputs, amarre, "tercer_orden");
  const result = computeVisitBook(inputs, amarre.elevation, "tercer_orden");
  const derived = deriveControlElevations(result, POINTS, "2025-03-01");
  return { rows, check, result, derived };
}

describe("generateVisitBook", () => {
  it("genera una libreta válida, cerrada en el amarre, con dos armadas y un punto de cambio", () => {
    const { rows, check } = run(1.3);
    expect(check.errors).toEqual([]);
    expect(check.rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
    // Ni siquiera avisos: las visuales quedan equilibradas.
    expect(check.rowIssues.every((i) => !i.warnings.sightBalance)).toBe(true);
    expect(rows[0]).toMatchObject({ pointCode: "BM-1", pointType: "bm" });
    expect(rows.at(-1)).toMatchObject({ pointCode: "BM-1", pointType: "bm" });
    expect(rows.filter((r) => r.pointType === "pc").map((r) => r.pointCode)).toEqual(["CP-1"]);
    expect(rows.filter((r) => r.pointType === "intermediate")).toHaveLength(8);
  });

  it("cierra con el error pedido y cumple la tolerancia", () => {
    const { result } = run(-2.4);
    expect(result.arithmeticCheckOk).toBe(true);
    expect(result.closureErrorMm).toBeCloseTo(-2.4, 6);
    expect(result.meetsTolerance).toBe(true);
  });

  it("las cotas compensadas reproducen las objetivo a la resolución de la base", () => {
    for (const closure of [0, 1.3, -2.4, 3.9]) {
      for (const seed of [1, 7, 42]) {
        const { derived } = run(closure, { code: "BM-2", elevation: 100.845 }, seed);
        expect(derived.issues).toEqual([]);
        for (const t of TARGETS) {
          const got = derived.readings.find((r) => r.pointId === t.code)!.elevation;
          expect(Math.abs(got - t.elevation)).toBeLessThanOrEqual(0.0001 + 1e-9);
        }
      }
    }
  });

  it("fuera de tolerancia no compensa, y las cotas calculadas son las objetivo", () => {
    const { result, derived } = run(9.8);
    expect(result.meetsTolerance).toBe(false);
    for (const t of TARGETS) {
      const got = derived.readings.find((r) => r.pointId === t.code)!.elevation;
      expect(Math.abs(got - t.elevation)).toBeLessThanOrEqual(0.0001 + 1e-9);
    }
  });

  it("es determinista: la misma semilla da la misma libreta", () => {
    expect(run(1.3).rows).toEqual(run(1.3).rows);
    expect(run(1.3, undefined, 8).rows).not.toEqual(run(1.3).rows);
  });

  it("con cuatro puntos o menos usa una sola armada", () => {
    const rows = generateVisitBook({
      amarre: { code: "BM-1", elevation: 100 },
      targets: TARGETS.slice(0, 3),
      closureMm: 0.5,
      order: "tercer_orden",
      seed: 3,
    });
    expect(rows.some((r) => r.pointType === "pc")).toBe(false);
    expect(rows).toHaveLength(5);
  });
});
