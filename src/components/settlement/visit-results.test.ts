import { describe, expect, it } from "vitest";
import { computeHistory } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { PointInput, VisitInput } from "@/types/settlement";
import { visitResultsOf } from "./visit-results";

const P: PointInput[] = [
  { id: "a", code: "A1", initialElevation: 50, activeFrom: null, retiredOn: null },
  { id: "b", code: "B10", initialElevation: 100, activeFrom: null, retiredOn: null },
  { id: "c", code: "B4", initialElevation: 80, activeFrom: null, retiredOn: null },
];
const visit = (n: number, date: string, a: number, b: number, c: number): VisitInput => ({
  id: `v${n}`,
  visitNumber: n,
  date,
  readings: [
    { pointId: "a", elevation: a },
    { pointId: "b", elevation: b },
    { pointId: "c", elevation: c },
  ],
});
const history = computeHistory(
  P,
  [visit(1, "2025-01-01", 50, 100, 80), visit(2, "2025-05-01", 49.998, 99.994, 79.999), visit(3, "2025-05-21", 49.998, 99.993, 79.998)],
  thresholdsFor("edificio"),
).visits;

describe("visitResultsOf (Fase 37, decisión 20)", () => {
  const r = visitResultsOf(history, "v3", P);

  it("la franja: el máximo con sus puntos, el promedio frente a la anterior, el mayor movimiento y la alerta", () => {
    expect(r.max).toEqual({ value: -7, codes: ["B10"] });
    expect(r.mean?.value).toBeCloseTo(-3.67, 2);
    expect(r.mean?.change).toBeCloseTo(-0.67, 2);
    expect(r.mean?.previousNumber).toBe(2);
    expect(r.move).toEqual({ value: -1, codes: ["B4", "B10"], days: 20 });
    expect(r.alert).toEqual({ level: "normal", count: 0, total: 3 });
  });

  it("una fila por punto leído, por código, con su cota y su tendencia", () => {
    expect(r.rows.map((x) => [x.code, x.elevation, x.partial, x.accumulated, x.trend])).toEqual([
      ["A1", 49.998, 0, -2, "converging"],
      ["B4", 79.998, -1, -2, "converging"],
      ["B10", 99.993, -1, -7, "converging"],
    ]);
  });

  it("la visita base no tiene movimiento ni promedio anterior", () => {
    const base = visitResultsOf(history, "v1", P);
    expect(base.move).toBeNull();
    expect(base.mean?.change).toBeNull();
    expect(base.rows.every((x) => x.partial === null && x.trend === null)).toBe(true);
  });

  it("una visita sin lecturas no tiene franja", () => {
    expect(visitResultsOf(history, "nada", P)).toMatchObject({ max: null, mean: null, move: null, rows: [] });
  });
});
