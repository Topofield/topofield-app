import { describe, expect, it } from "vitest";
import { generateVisitBook } from "./libreta-asentamientos";
import { bookRowInputOf } from "@/lib/calculations/settlement-book";
import { visitRecordOf } from "@/lib/calculations/visit-record";
import { validateBook } from "@/lib/validators/settlement-book";
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
  initialElevation: null,
  activeFrom: null,
  retiredOn: null,
}));

// Desde la Fase 37 la libreta se calcula como la guarda la app: por tramos y
// sin compensar (`visitRecordOf`).
function run(closureMm: number, amarre = { code: "BM-1", elevation: 100 }, seed = 7) {
  const rows = generateVisitBook({ amarre, targets: TARGETS, closureMm, order: "tercer_orden", seed });
  const check = validateBook(rows.map(bookRowInputOf), [amarre]);
  const record = visitRecordOf({ visitId: "v", date: "2025-03-01", rows, points: POINTS, benchmarks: [amarre] });
  return { rows, check, record };
}

const elevationOf = (record: ReturnType<typeof run>["record"], code: string) =>
  record.elevations.find((r) => r.pointId === code)!.elevation;

describe("generateVisitBook", () => {
  it("genera una libreta válida, cerrada en el amarre, con dos armadas y un punto de cambio", () => {
    const { rows, check } = run(1.3);
    expect(check.errors).toEqual([]);
    expect(check.rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
    expect(rows[0]).toMatchObject({ pointCode: "BM-1", pointType: "bm" });
    expect(rows.at(-1)).toMatchObject({ pointCode: "BM-1", pointType: "bm" });
    expect(rows.filter((r) => r.pointType === "pc").map((r) => r.pointCode)).toEqual(["CP-1"]);
    expect(rows.filter((r) => r.pointType === "intermediate")).toHaveLength(8);
  });

  it("cierra en el amarre con el error pedido y alcanza un orden", () => {
    const [tramo] = run(-2.4).record.book.tramos;
    expect(tramo).toMatchObject({ kind: "closed", closureMm: -2.4, complete: true });
    expect(tramo!.order).not.toBeNull();
  });

  it("sin compensar, cada cota se aparta de la objetivo menos que el cierre", () => {
    for (const closure of [0, 1.3, -2.4, 3.9]) {
      for (const seed of [1, 7, 42]) {
        const { record } = run(closure, { code: "BM-2", elevation: 100.845 }, seed);
        expect(record.issues).toEqual([]);
        for (const t of TARGETS) {
          const offMm = Math.abs(elevationOf(record, t.code) - t.elevation) * 1000;
          expect(offMm).toBeLessThanOrEqual(Math.abs(closure) + 0.1);
        }
      }
    }
  });

  it("un cierre fuera de todos los órdenes deja las cotas en las objetivo y la visita sin orden", () => {
    const { record } = run(9.8);
    expect(record.header.precision_order).toBeNull();
    for (const t of TARGETS) {
      expect(Math.abs(elevationOf(record, t.code) - t.elevation)).toBeLessThanOrEqual(0.0001 + 1e-9);
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
