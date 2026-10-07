import { describe, expect, it } from "vitest";
import { bookVerification, computeBook, tramoStarts } from "./settlement-book";
import type { BookRowInput } from "./settlement-book";
import type { PointType } from "@/types/leveling";

function r(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null = null,
  foreDistanceM: number | null = null,
  startsSection = false,
): BookRowInput {
  return {
    pointCode, pointType, backsight, foresight,
    backUpperM: null, backLowerM: null, foreUpperM: null, foreLowerM: null,
    backDistanceM, foreDistanceM, distanceAccumulatedKm: null, startsSection,
  };
}
const el = (book: ReturnType<typeof computeBook>, i: number) =>
  Number(book.readings[i]!.elevationCalculated.toFixed(4));

// Torre Alameda, visita 12 (lienzo «Visita con dos armadas»): BM-1 → CP-1 → BM-1.
const alameda12 = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("TA-02", "intermediate", null, 1.297),
  r("TA-03", "intermediate", null, 1.3549),
  r("TA-04", "intermediate", null, 1.3838),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("TA-05", "intermediate", null, 0.8349),
  r("TA-06", "intermediate", null, 0.7772),
  r("TA-07", "intermediate", null, 0.7387),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];

describe("los tramos de la libreta de una visita", () => {
  it("la primera fila siempre abre un tramo; las marcadas, otro", () => {
    expect(tramoStarts([{}, { startsSection: false }, { startsSection: true }, {}])).toEqual([0, 2]);
  });

  it("Torre Alameda, visita 12: un tramo cerrado, sin compensar, segundo orden", () => {
    const book = computeBook(alameda12, BMS);
    expect(book.tramos).toHaveLength(1);
    const [t] = book.tramos;
    expect(t).toMatchObject({ start: 0, end: 11, startCode: "BM-1", endCode: "BM-1", kind: "closed", order: "segundo_orden" });
    expect(t!.closureMm).toBe(-1.6);
    expect(el(book, 1)).toBe(100.8446); // BM-2, leído de paso
    expect(el(book, 6)).toBe(100.6485); // CP-1
    expect(el(book, 10)).toBe(100.5836); // TA-08
    expect(el(book, 11)).toBe(99.9984); // BM-1 medido: sin compensar
  });

  it("la cartera real, visita 3: una armada de radiaciones, abierta y sin orden", () => {
    const rows = [
      r("PISCINA/BM", "bm", 1.45, null, null, null, true),
      r("A4(8-7A)", "intermediate", null, 1.053),
      r("B10", "intermediate", null, 4.12),
    ];
    const book = computeBook(rows, [{ code: "PISCINA/BM", elevation: 156.299 }]);
    expect(book.tramos[0]).toMatchObject({ kind: "open", endCode: null, closureMm: null, order: null });
    expect(book.readings[0]!.instrumentHeight).toBeCloseTo(157.749, 6);
    expect(el(book, 1)).toBe(156.696);
    expect(el(book, 2)).toBe(153.629);
  });

  it("un tramo que vuelve a arrancar en otro BM toma su cota, no la de la cadena", () => {
    const rows = [
      r("BM-1", "bm", 1.5, null, null, null, true),
      r("TA-01", "intermediate", null, 1.0),
      r("BM-2", "bm", 1.2, null, null, null, true),
      r("TA-05", "intermediate", null, 1.0),
    ];
    const book = computeBook(rows, BMS);
    expect(book.tramos.map((t) => [t.start, t.end, t.startCode, t.kind])).toEqual([
      [0, 1, "BM-1", "open"],
      [2, 3, "BM-2", "open"],
    ]);
    expect(el(book, 1)).toBe(100.5);
    expect(el(book, 3)).toBe(101.045);
  });

  it("un tramo que termina en otro BM del lugar es de enlace", () => {
    const rows = [
      r("BM-1", "bm", 1.8637, null, 28.4, null, true),
      r("TA-01", "intermediate", null, 1.2682),
      r("BM-2", "bm", null, 1.0191, null, 28.4),
    ];
    const [t] = computeBook(rows, BMS).tramos;
    expect(t).toMatchObject({ kind: "link", endCode: "BM-2" });
    expect(t!.closureMm).toBe(-0.4);
  });

  it("un tramo que arranca en un código que no es BM del lugar no tiene cotas", () => {
    const book = computeBook([r("X-9", "bm", 1.2, null, null, null, true), r("TA-01", "intermediate", null, 1)], BMS);
    expect(book.tramos[0]!.startElevation).toBeNull();
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
  });

  it("una fila sin lectura no tiene cota y no rompe la cadena", () => {
    const rows = [
      r("BM-1", "bm", 1.5, null, null, null, true),
      r("TA-01", "intermediate", null, null),
      r("TA-02", "intermediate", null, 1.0),
    ];
    const book = computeBook(rows, BMS);
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
    expect(el(book, 2)).toBe(100.5);
  });

  it("sin la V+ de la armada, ninguna de sus lecturas tiene cota", () => {
    const book = computeBook([r("BM-1", "bm", null, null, null, null, true), r("TA-01", "intermediate", null, 1.0)], BMS);
    expect(el(book, 0)).toBe(100);
    expect(Number.isNaN(book.readings[1]!.elevationCalculated)).toBe(true);
  });

  it("un punto de cambio sin su V− deja sin cota lo que sigue, y el tramo sin cierre", () => {
    const rows = alameda12.map((row, i) => (i === 6 ? { ...row, foresight: null } : row));
    const book = computeBook(rows, BMS);
    expect(el(book, 5)).toBe(100.4799);
    expect([6, 7, 11].every((i) => Number.isNaN(book.readings[i]!.elevationCalculated))).toBe(true);
    expect(book.tramos[0]).toMatchObject({ complete: false, closureMm: null, order: null });
  });

  it("la plantilla de una visita nueva, sin ninguna lectura, no da cotas ni cierre", () => {
    const blank = alameda12.map((row) => ({ ...row, backsight: null, foresight: null }));
    const book = computeBook(blank, BMS);
    expect(book.readings.slice(1).every((x) => Number.isNaN(x.elevationCalculated))).toBe(true);
    expect(book.tramos[0]).toMatchObject({ kind: "open", complete: false, closureMm: null });
  });

  it("la verificación de la visita es la de su tramo peor", () => {
    const closed = computeBook(alameda12, BMS);
    expect(bookVerification(closed)).toMatchObject({ verified: true, order: "segundo_orden" });
    const mixed = computeBook([...alameda12, r("BM-2", "bm", 1.2, null, null, null, true), r("TA-05", "intermediate", null, 1)], BMS);
    const v = bookVerification(mixed);
    expect(v.verified).toBe(false);
    expect(v.order).toBeNull();
    expect(v.worst!.kind).toBe("open");
  });
});
