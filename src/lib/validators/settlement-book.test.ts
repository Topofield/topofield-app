import { describe, expect, it } from "vitest";
import { bookIssueMessage, validateVisitBook } from "./settlement-book";
import { validateVisitClose } from "./settlement";
import type { PointType, ReadingInput as BookRow } from "@/types/leveling";
import type { PointInput, VisitInput } from "@/types/settlement";

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

/** Una armada: amarre, un punto de control y cierre en el amarre. */
const BOOK = [
  row("BM-1", "bm", 1.5, null, 30, null),
  row("PC-01", "intermediate", null, 1.2),
  row("BM-1", "bm", null, 1.5001, null, 30),
];
const AMARRE = { code: "BM-1", elevation: 100 };

describe("validateVisitBook", () => {
  it("una libreta bien formada no tiene errores", () => {
    const r = validateVisitBook(BOOK, AMARRE, "tercer_orden");
    expect(r.errors).toEqual([]);
    expect(r.rowIssues.every((i) => Object.keys(i.errors).length === 0)).toBe(true);
  });

  it("una libreta vacía no exige nada", () => {
    const r = validateVisitBook([], { code: "", elevation: null }, "tercer_orden");
    expect(r.errors).toEqual([]);
    expect(r.rowIssues).toEqual([]);
  });

  it("con lecturas exige el código y la cota del amarre", () => {
    expect(validateVisitBook(BOOK, { code: " ", elevation: 100 }, "tercer_orden").errors).toEqual([
      "Falta el BM de amarre de la visita.",
    ]);
    expect(validateVisitBook(BOOK, { code: "BM-1", elevation: null }, "tercer_orden").errors).toEqual([
      "Falta la cota del BM de amarre.",
    ]);
  });

  it("rechaza números no finitos, que una llamada directa sí puede enviar", () => {
    const rows = [{ ...BOOK[0]!, backsight: Number.NaN }, BOOK[1]!, BOOK[2]!];
    expect(validateVisitBook(rows, AMARRE, "tercer_orden").errors).toContain(
      "La libreta tiene un valor que no es un número.",
    );
    expect(
      validateVisitBook(BOOK, { code: "BM-1", elevation: Infinity }, "tercer_orden").errors,
    ).toContain("La libreta tiene un valor que no es un número.");
  });

  it("exige al menos la fila del amarre y la de cierre", () => {
    const r = validateVisitBook([BOOK[0]!], AMARRE, "tercer_orden");
    expect(r.errors).toEqual([
      "La libreta necesita al menos la fila del amarre y la de cierre.",
    ]);
  });

  it("la primera y la última fila deben ser el amarre", () => {
    const rows = [
      row("BM-2", "bm", 1.5, null, 30, null),
      row("PC-01", "intermediate", null, 1.2),
      row("PC-01", "bm", null, 1.5, null, 30),
    ];
    const r = validateVisitBook(rows, AMARRE, "tercer_orden");
    expect(r.rowIssues[0]!.errors.pointCode).toBe(
      "La libreta arranca en el BM de amarre (BM-1).",
    );
    expect(r.rowIssues[2]!.errors.pointCode).toBe(
      "La libreta cierra en el BM de amarre (BM-1).",
    );
  });

  it("el amarre se reconoce sin distinguir espacios ni mayúsculas", () => {
    const rows = BOOK.map((x) => ({ ...x, pointCode: x.pointCode === "BM-1" ? "bm-1 " : x.pointCode }));
    const r = validateVisitBook(rows, AMARRE, "tercer_orden");
    expect(r.rowIssues[0]!.errors.pointCode).toBeUndefined();
  });

  it("la primera fila debe ser de tipo BM", () => {
    const rows = [{ ...BOOK[0]!, pointType: "pc" as const }, BOOK[1]!, BOOK[2]!];
    const r = validateVisitBook(rows, AMARRE, "tercer_orden");
    expect(r.rowIssues[0]!.errors.pointType).toBe("El amarre es de tipo BM.");
  });

  it("propaga los errores de captura de nivelación", () => {
    const rows = [row("BM-1", "bm", 5.2, null, 30, null), BOOK[1]!, BOOK[2]!];
    const r = validateVisitBook(rows, AMARRE, "tercer_orden");
    expect(r.rowIssues[0]!.errors.backsight).toBeDefined();
    // La última fila de un circuito cerrado debe ser BM (regla de nivelación).
    const open = [BOOK[0]!, BOOK[1]!, { ...BOOK[2]!, pointType: "pc" as const }];
    expect(validateVisitBook(open, AMARRE, "tercer_orden").rowIssues[2]!.errors.pointType).toBeDefined();
  });
});

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

describe("validateVisitClose — libreta (Fase 18)", () => {
  const P1: PointInput = {
    id: "p1",
    code: "PC-01",
    northing: null,
    easting: null,
    initialElevation: 100,
    activeFrom: null,
    retiredOn: null,
  };
  const visit: VisitInput = {
    id: "v1",
    visitNumber: 1,
    date: "2025-02-01",
    readings: [{ pointId: "p1", elevation: 99.99 }],
  };

  it("una comprobación aritmética fallida bloquea el cierre", () => {
    const r = validateVisitClose(visit, [P1], "2025-01-01", [], { arithmeticCheckOk: false });
    expect(r.errors.book).toBe(
      "La comprobación aritmética de la libreta no cuadra: ΣV+ − ΣV− no coincide con el desnivel.",
    );
  });

  it("fuera de tolerancia no bloquea: solo avisa (decisión 5)", () => {
    const r = validateVisitClose(visit, [P1], "2025-01-01", [], { arithmeticCheckOk: true });
    expect(r.errors).toEqual({});
  });

  it("sin libreta no cambia nada", () => {
    expect(validateVisitClose(visit, [P1], "2025-01-01", []).errors).toEqual({});
  });
});
