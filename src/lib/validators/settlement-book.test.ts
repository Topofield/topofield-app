import { describe, expect, it } from "vitest";
import { benchmarkCheckMessage, bookIssueMessage, validateBook } from "./settlement-book";
import type { PointType, ReadingInput as BookRow } from "@/types/leveling";

function row(
  pointCode: string,
  pointType: PointType,
  backsight: number | null,
  foresight: number | null,
  backDistanceM: number | null = null,
  foreDistanceM: number | null = null,
): BookRow {
  return {
    pointCode,
    pointType,
    backsight,
    foresight,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
    backDistanceM,
    foreDistanceM,
    distanceAccumulatedKm: null,
  };
}

describe("bookIssueMessage", () => {
  it("numera las filas desde 1", () => {
    expect(
      bookIssueMessage({ kind: "duplicate", level: "error", pointId: "x", code: "PC-03", rows: [3, 9] }),
    ).toBe("PC-03 tiene vista menos en las filas 4 y 10: deja solo una.");
    expect(
      bookIssueMessage({ kind: "inactive", level: "warning", pointId: "x", code: "PC-02", row: 2 }),
    ).toBe("PC-02 no está vigente en la fecha de la visita: su lectura (fila 3) no se usa.");
    expect(
      bookIssueMessage({ kind: "missing", level: "warning", pointId: "x", code: "PC-04" }),
    ).toBe("PC-04 no tiene vista menos en la libreta: queda sin cota.");
  });
});

describe("benchmarkCheckMessage (Fase 30)", () => {
  const base = {
    rowIndex: 5,
    code: "BM-2",
    catalogElevation: 100.345,
    measuredElevation: 100.3438,
    differenceMm: -1.2,
    toleranceMm: 3.436,
    meetsTolerance: true,
  };

  it("dice que nivela, con la diferencia y la tolerancia", () => {
    expect(benchmarkCheckMessage(base, "BM-1")).toBe("BM-2 nivela con BM-1: -1.2 mm, tolerancia 3.4 mm.");
  });

  it("si no nivela, da las dos cotas y no culpa a ningún BM", () => {
    expect(
      benchmarkCheckMessage(
        { ...base, measuredElevation: 100.35, differenceMm: 5, meetsTolerance: false },
        "BM-1",
      ),
    ).toBe(
      "BM-2 no nivela con BM-1: la libreta lo da en 100.3500 y el catálogo en 100.3450 (+5.0 mm, tolerancia 3.4 mm). Uno de los dos BM pudo moverse, o hay un error en la libreta o en la cota del catálogo.",
    );
  });

  it("sin distancias da la diferencia y dice que no se evalúa", () => {
    expect(
      benchmarkCheckMessage({ ...base, differenceMm: 2, toleranceMm: null, meetsTolerance: null }, "BM-1"),
    ).toBe("BM-2 frente a BM-1: +2.0 mm. Sin distancias por visual no se evalúa la tolerancia.");
  });
});

describe("validateBook (Fase 37)", () => {
  const BMS = [{ code: "BM-1", elevation: 100 }];
  /** Una fila con su marca de inicio de tramo. */
  const at = (
    pointCode: string,
    pointType: PointType,
    backsight: number | null,
    foresight: number | null,
    startsSection = false,
  ) => ({ ...row(pointCode, pointType, backsight, foresight), startsSection });

  it("una libreta vacía no exige nada", () => {
    expect(validateBook([], BMS)).toEqual({ rowIssues: [], errors: [] });
  });

  it("cada tramo arranca en un BM del lugar", () => {
    const rows = [at("BM-1", "bm", 1.2, null, true), at("P-1", "intermediate", null, 1), at("X-9", "bm", 1.1, null, true)];
    expect(validateBook(rows, BMS).errors).toEqual(["La armada 2 sale de X-9, que no está en los BM del lugar."]);
  });

  it("las lecturas por leer no son error", () => {
    const rows = [at("BM-1", "bm", null, null, true), at("P-1", "intermediate", null, null), at("BM-1", "bm", null, null)];
    const v = validateBook(rows, BMS);
    expect(v.errors).toEqual([]);
    expect(v.rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
  });

  it("la distancia es opcional: sin ella el tramo solo queda sin orden", () => {
    const rows = [at("BM-1", "bm", 1.45, null, true), at("CP-1", "pc", 1.3, 1.2), at("BM-1", "bm", null, 1.5)];
    expect(validateBook(rows, BMS).rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
  });

  it("una distancia tecleada sigue sin poder ser cero", () => {
    const rows = [{ ...at("BM-1", "bm", 1.45, null, true), backDistanceM: 0 }];
    expect(validateBook(rows, BMS).rowIssues[0]!.errors.backDistanceM).toBe("La distancia debe ser mayor que cero.");
  });

  it("un valor que no es número es error", () => {
    expect(validateBook([at("BM-1", "bm", Number.NaN, null, true)], BMS).errors).toContain(
      "La libreta tiene un valor que no es un número.",
    );
  });
});
