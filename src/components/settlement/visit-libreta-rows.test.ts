import { describe, expect, it } from "vitest";
import { computeHistory } from "@/lib/calculations/settlement";
import { bookBenchmarkChecks, bookElevations, bookRowInputOf, computeBook } from "@/lib/calculations/settlement-book";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { BookRowPayload, PointInput, VisitInput } from "@/types/settlement";
import { armadaItems, pointIssueAlerts, pointMovements, resumeOf, tramoItems, visitSheetRows } from "./visit-libreta-rows";

const BMS = [
  { code: "BM-1", elevation: 100 },
  { code: "BM-2", elevation: 100.845 },
];

function r(pointCode: string, pointType: BookRowPayload["pointType"], v: Partial<BookRowPayload> = {}): BookRowPayload {
  return {
    pointCode, pointType, startsSection: false,
    backsight: null, foresight: null, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
    ...v,
  };
}

/** La visita 12 de Torre Alameda, recortada: dos armadas por CP-1 y BM-2 leído de paso. */
const ALAMEDA: BookRowPayload[] = [
  r("BM-1", "bm", { startsSection: true, backsight: 1.8637, backDistanceM: 28.4 }),
  r("BM-2", "intermediate", { foresight: 1.0191 }),
  r("TA-01", "intermediate", { foresight: 1.2682 }),
  r("CP-1", "pc", { foresight: 1.2152, foreDistanceM: 27.8, backsight: 0.6263, backDistanceM: 28.2 }),
  r("TA-05", "intermediate", { foresight: 0.8349 }),
  r("BM-1", "bm", { foresight: 1.2764, foreDistanceM: 28.3 }),
];
const POINTS = [{ code: "TA-01" }, { code: "TA-05" }];

function sheet(rows: BookRowPayload[]) {
  const inputs = rows.map(bookRowInputOf);
  const book = computeBook(inputs, BMS);
  return visitSheetRows(rows, book, bookBenchmarkChecks(book, inputs, BMS, POINTS));
}

describe("visitSheetRows (Fase 37, decisión 7)", () => {
  it("rotula el arranque, el BM leído de paso, el punto de cambio y el cierre", () => {
    expect(sheet(ALAMEDA).map((s) => s.badge)).toEqual([
      "BM del lugar", "BM · -0.4 mm", null, "punto de cambio", null, "cierra",
    ]);
  });

  it("da la cota de la medida, sin compensar, y la AI donde hay V+", () => {
    const rows = sheet(ALAMEDA);
    const cotas = [100, 100.8446, 100.5955, 100.6485, 100.4399, 99.9984];
    rows.forEach((s, i) => expect(s.elevation).toBeCloseTo(cotas[i]!, 4));
    expect(rows[0]!.instrumentHeight).toBeCloseTo(101.8637, 4);
    expect(rows[3]!.instrumentHeight).toBeCloseTo(101.2748, 4);
    expect(rows[1]!.instrumentHeight).toBeNull();
  });

  it("las vistas a los puntos van en VI; el punto de cambio lleva V− y V+", () => {
    const rows = sheet(ALAMEDA);
    expect(rows[1]).toMatchObject({ intermediate: 1.0191, foresight: null, backsight: null });
    expect(rows[3]).toMatchObject({ foresight: 1.2152, backsight: 0.6263, intermediate: null });
  });

  it("el lápiz de cada fila abre la armada que la fila cierra o en la que está", () => {
    expect(sheet(ALAMEDA).map((s) => s.armada)).toEqual([0, 0, 0, 0, 1, 1]);
  });

  it("un punto sin leer queda «pendiente», sin cota", () => {
    const rows = sheet([ALAMEDA[0]!, r("TA-01", "intermediate"), r("TA-05", "intermediate", { foresight: 1.3 })]);
    expect(rows[1]).toMatchObject({ badge: "pendiente", elevation: null, pending: true });
    expect(rows[2]!.pending).toBe(false);
  });

  it("un tramo de enlace llega a otro BM del lugar", () => {
    const rows = [ALAMEDA[0]!, r("BM-2", "bm", { foresight: 1.0187, foreDistanceM: 20 })];
    expect(sheet(rows).map((s) => s.badge)).toEqual(["BM del lugar", "llega"]);
  });
});

describe("armadaItems", () => {
  it("resume cada armada: de dónde sale, sus vistas y su V−", () => {
    expect(armadaItems(ALAMEDA).map(({ title, detail, pending }) => ({ title, detail, pending }))).toEqual([
      { title: "Armada 1 · desde BM-1", detail: "BM del lugar · 2 vistas a puntos · V− a CP-1", pending: false },
      { title: "Armada 2 · desde CP-1", detail: "punto de cambio · 1 vista a un punto · V− a BM-1", pending: false },
    ]);
  });

  it("una armada a medias dice cuántos puntos van leídos", () => {
    const rows = [ALAMEDA[0]!, r("TA-01", "intermediate", { foresight: 1.2 }), r("TA-05", "intermediate")];
    expect(armadaItems(rows)[0]).toMatchObject({
      detail: "BM del lugar · 1 de 2 puntos · a medias",
      pending: true,
    });
  });

  it("sin vista adelante, la armada termina en sus puntos", () => {
    const rows = [ALAMEDA[0]!, r("TA-01", "intermediate", { foresight: 1.2 })];
    expect(armadaItems(rows)[0]!.detail).toBe("BM del lugar · 1 vista a un punto · sin vista adelante");
  });

  it("lleva las vistas de cada punto con su cota, para el teléfono", () => {
    const inputs = ALAMEDA.map(bookRowInputOf);
    const item = armadaItems(ALAMEDA, computeBook(inputs, BMS))[1]!;
    expect(item.points).toHaveLength(1);
    expect(item.points[0]!.code).toBe("TA-05");
    expect(item.points[0]!.elevation).toBeCloseTo(100.4399, 4);
  });
});

describe("tramoItems (decisiones 14 y 15)", () => {
  const items = (rows: BookRowPayload[]) => tramoItems(computeBook(rows.map(bookRowInputOf), BMS));

  it("un tramo cerrado da su cierre y el orden que alcanza", () => {
    expect(items(ALAMEDA)).toEqual([
      {
        title: "Tramo desde BM-1",
        route: "vuelve a BM-1",
        closure: "-1.6 mm",
        verdict: "Segundo orden (2.0 mm en 0.113 km)",
        verified: true,
      },
    ]);
  });

  it("uno abierto queda sin verificación", () => {
    expect(items([ALAMEDA[0]!, r("TA-01", "intermediate", { foresight: 1.2 })])[0]).toEqual({
      title: "Tramo desde BM-1",
      route: "termina en sus puntos",
      closure: null,
      verdict: "Sin verificación: no termina en un BM del lugar.",
      verified: false,
    });
  });

  it("sin distancias, el cierre no da orden", () => {
    const rows = ALAMEDA.map((x) => ({ ...x, backDistanceM: null, foreDistanceM: null }));
    expect(items(rows)[0]).toMatchObject({
      closure: "-1.6 mm",
      verdict: "Sin distancias: el cierre no da orden.",
      verified: false,
    });
  });

  it("un tramo a medias lo dice", () => {
    const rows = [...ALAMEDA.slice(0, 5), r("BM-1", "bm")];
    expect(items(rows)[0]).toMatchObject({ route: "a medias", verdict: "Falta leer parte de la cadena.", verified: false });
  });
});

describe("resumeOf (decisión 9)", () => {
  it("sin nada pendiente no hay qué retomar", () => {
    expect(resumeOf(ALAMEDA)).toBeNull();
  });

  it("sigue en el primer punto sin leer de la armada", () => {
    const rows = [
      ALAMEDA[0]!,
      r("B4", "intermediate", { foresight: 4.058 }),
      r("B5", "intermediate"),
      r("B6", "intermediate"),
    ];
    expect(resumeOf(rows)).toEqual({ k: 0, rowIndex: 2, text: "Armada 1: 1 de 3 puntos leídos. Falta desde B5." });
  });

  it("sin la V+ del arranque, falta la vista atrás", () => {
    const rows = [r("BM-1", "bm", { startsSection: true }), r("TA-01", "intermediate")];
    expect(resumeOf(rows)).toEqual({ k: 0, rowIndex: 0, text: "Armada 1: falta la vista atrás a BM-1." });
  });

  it("con los puntos leídos y sin la V−, falta la vista adelante", () => {
    const rows = [...ALAMEDA.slice(0, 5), r("BM-1", "bm")];
    expect(resumeOf(rows)).toEqual({ k: 1, rowIndex: 5, text: "Armada 2: falta la vista adelante a BM-1." });
  });
});

describe("pointMovements (decisión 20)", () => {
  const P: PointInput = { id: "p1", code: "B10", initialElevation: 100, activeFrom: null, retiredOn: null };
  const visit = (n: number, date: string, elevation: number): VisitInput => ({
    id: `v${n}`, visitNumber: n, date, readings: [{ pointId: "p1", elevation }],
  });
  const history = (last: number) =>
    computeHistory(
      [P],
      [visit(0, "2025-01-01", 100), visit(1, "2025-01-31", 99.997), visit(2, "2025-02-12", last)],
      thresholdsFor("edificio"),
    ).visits;

  it("da el movimiento desde la visita anterior y los días", () => {
    const [m] = pointMovements(history(99.995), "v2", [{ id: "p1", code: "B10" }]);
    expect(m).toMatchObject({ pointId: "p1", code: "B10", days: 12, warning: null });
    expect(m!.partialMm).toBeCloseTo(-2, 6);
  });

  it("avisa un movimiento excesivo frente a su ritmo anterior", () => {
    const [m] = pointMovements(history(99.947), "v2", [{ id: "p1", code: "B10" }]);
    expect(m!.warning).toBe("B10 bajó 50.0 mm en 12 días; a su ritmo anterior serían unos 1.2 mm.");
  });

  it("avisa un movimiento contrario a su tendencia", () => {
    const [m] = pointMovements(history(100.042), "v2", [{ id: "p1", code: "B10" }]);
    expect(m!.warning).toBe("B10 subió 45.0 mm en 12 días; venía bajando 3.0 mm/mes.");
  });

  it("en la visita base no hay movimiento", () => {
    const [m] = pointMovements(history(99.995), "v0", [{ id: "p1", code: "B10" }]);
    expect(m).toMatchObject({ partialMm: null, days: null, warning: null });
  });
});

describe("pointIssueAlerts (revisión final de la Fase 37)", () => {
  const point = (id: string, code: string, retiredOn: string | null = null): PointInput => ({
    id, code, initialElevation: null, activeFrom: null, retiredOn,
  });

  it("avisa los puntos vigentes sin lectura, juntos, y la lectura de un punto dado de baja", () => {
    const points = [point("a", "TA-01"), point("b", "TA-05", "2024-01-01"), point("c", "TA-07"), point("d", "TA-08")];
    const inputs = ALAMEDA.map(bookRowInputOf);
    const { issues } = bookElevations(computeBook(inputs, BMS), inputs, points, "2024-06-01");
    expect(pointIssueAlerts(issues)).toEqual([
      "TA-05 no está vigente en la fecha de la visita: su lectura (fila 5) no se usa.",
      "TA-07 y TA-08 no tienen lectura en la libreta: quedan sin cota en esta visita.",
    ]);
  });

  it("un punto con su fila por leer no es un punto sin lectura", () => {
    const rows = [...ALAMEDA.slice(0, -1), r("TA-07", "intermediate"), ALAMEDA.at(-1)!];
    const inputs = rows.map(bookRowInputOf);
    const points = [point("a", "TA-01"), point("b", "TA-05"), point("c", "TA-07")];
    const { issues } = bookElevations(computeBook(inputs, BMS), inputs, points, "2024-06-01");
    expect(pointIssueAlerts(issues)).toEqual([]);
  });

  it("un solo punto sin lectura va en singular", () => {
    const inputs = ALAMEDA.map(bookRowInputOf);
    const points = [point("a", "TA-01"), point("b", "TA-05"), point("c", "TA-07")];
    const { issues } = bookElevations(computeBook(inputs, BMS), inputs, points, "2024-06-01");
    expect(pointIssueAlerts(issues)).toEqual(["TA-07 no tiene lectura en la libreta: queda sin cota en esta visita."]);
  });
});
