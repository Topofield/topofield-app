import { describe, expect, it } from "vitest";
import {
  auxiliaryPoints, bookElevations, bookPending, bookTemplate, computeBook, visitStatusOf,
  type BookRowInput,
} from "./settlement-book";
import type { PointType } from "@/types/leveling";
import type { PointInput } from "@/types/settlement";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  startsSection = false): BookRowInput {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
    distanceAccumulatedKm: null, startsSection };
}
const point = (code: string, retiredOn: string | null = null, activeFrom: string | null = null): PointInput =>
  ({ id: code, code, initialElevation: null, activeFrom, retiredOn });

const alameda12 = [
  r("BM-1", "bm", 1.8637, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("TA-04", "intermediate", null, 1.3838),
  r("CP-1", "pc", 0.6263, 1.2152),
  r("TA-05", "intermediate", null, 0.8349),
  r("TA-08", "intermediate", null, 0.6912),
  r("BM-1", "bm", null, 1.2764),
];
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const POINTS = ["TA-01", "TA-04", "TA-05", "TA-08"].map((c) => point(c));
const DATE = "2025-10-14";

describe("las cotas de los puntos de la visita", () => {
  it("cada punto toma la cota de su lectura, sin corregir", () => {
    const book = computeBook(alameda12, BMS);
    const { readings, issues } = bookElevations(book, alameda12, POINTS, DATE);
    expect(readings.map((x) => [x.pointId, x.elevation])).toEqual([
      ["TA-01", 100.5955], ["TA-04", 100.4799], ["TA-05", 100.4399], ["TA-08", 100.5836],
    ]);
    expect(issues).toEqual([]);
  });

  it("un punto leído en dos armadas es un error con sus dos filas, y no da cota", () => {
    const rows = [...alameda12.slice(0, 6), r("TA-04", "intermediate", null, 0.7958), ...alameda12.slice(6)];
    const { readings, issues } = bookElevations(computeBook(rows, BMS), rows, POINTS, DATE);
    expect(readings.find((x) => x.pointId === "TA-04")).toBeUndefined();
    expect(issues).toContainEqual({ kind: "duplicate", level: "error", pointId: "TA-04", code: "TA-04", rows: [3, 6] });
  });

  it("un punto por leer no da cota ni aviso de ausente", () => {
    const rows = alameda12.map((row) => (row.pointCode === "TA-05" ? { ...row, foresight: null } : row));
    const { readings, issues } = bookElevations(computeBook(rows, BMS), rows, POINTS, DATE);
    expect(readings.map((x) => x.pointId)).toEqual(["TA-01", "TA-04", "TA-08"]);
    expect(issues).toEqual([]);
  });

  it("un punto vigente que no está en la libreta avisa", () => {
    const points = [...POINTS, point("TA-09")];
    const { issues } = bookElevations(computeBook(alameda12, BMS), alameda12, points, DATE);
    expect(issues).toEqual([{ kind: "missing", level: "warning", pointId: "TA-09", code: "TA-09" }]);
  });
});

describe("la plantilla de una visita nueva", () => {
  it("copia las armadas de la anterior, sin lecturas", () => {
    const t = bookTemplate(alameda12, POINTS, DATE, BMS);
    expect(t.map((x) => [x.pointCode, x.pointType, x.startsSection ?? false])).toEqual(
      alameda12.map((x) => [x.pointCode, x.pointType, x.startsSection ?? false]),
    );
    expect(t.every((x) => x.backsight == null && x.foresight == null && x.backDistanceM == null)).toBe(true);
  });

  it("quita el punto dado de baja y añade el nuevo antes del BM de cierre", () => {
    const points = [point("TA-01"), point("TA-04", "2025-10-01"), point("TA-05"), point("TA-08"), point("TA-09")];
    const codes = bookTemplate(alameda12, points, DATE, BMS).map((x) => x.pointCode);
    expect(codes).toEqual(["BM-1", "BM-2", "TA-01", "CP-1", "TA-05", "TA-08", "TA-09", "BM-1"]);
  });

  it("sin visita anterior: una armada desde el primer BM del lugar con los puntos vigentes", () => {
    const t = bookTemplate(null, POINTS, DATE, BMS);
    expect(t.map((x) => [x.pointCode, x.pointType])).toEqual([
      ["BM-1", "bm"], ["TA-01", "intermediate"], ["TA-04", "intermediate"], ["TA-05", "intermediate"], ["TA-08", "intermediate"],
    ]);
    expect(t[0]!.startsSection).toBe(true);
  });

  it("sin BM en el lugar no hay plantilla", () => {
    expect(bookTemplate(null, POINTS, DATE, [])).toEqual([]);
  });
});

describe("lo pendiente y el estado de la visita", () => {
  it("la plantilla espera todas sus lecturas", () => {
    const t = bookTemplate(alameda12, POINTS, DATE, BMS);
    expect(bookPending(t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(visitStatusOf(t)).toBe("in_progress");
  });

  it("la libreta completa no espera nada", () => {
    expect(bookPending(alameda12)).toEqual([]);
    expect(visitStatusOf(alameda12)).toBe("calculated");
    expect(visitStatusOf([])).toBe("draft");
  });

  it("una armada que termina en sus puntos no espera V−", () => {
    const cartera = [r("PISCINA/BM", "bm", 1.45, null, true), r("A1", "intermediate", null, 4.062), r("B10", "intermediate", null, null)];
    expect(bookPending(cartera)).toEqual([2]);
  });
});

describe("los puntos auxiliares", () => {
  it("una V− a un punto que no es de control ni BM del lugar", () => {
    expect(auxiliaryPoints(alameda12, POINTS, BMS)).toEqual([{ rowIndex: 4, code: "CP-1" }]);
    expect(auxiliaryPoints(alameda12, POINTS, [...BMS, { code: "CP-1", elevation: 100.6485 }])).toEqual([]);
  });
});
