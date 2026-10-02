import { describe, expect, it } from "vitest";
import {
  buildBookTemplate,
  catalogElevationsOf,
  checkBenchmarks,
  computeVisitBook,
  deriveControlElevations,
} from "./settlement-book";
import type { PointType, ReadingInput as BookRow } from "@/types/leveling";
import type { PointInput } from "@/types/settlement";

// --- Libreta con la forma de la del prototipo (PRD de la Fase 18, hallazgo 2):
// amarre BM-1 a 100.0000, cuatro intermedias en la armada 1, punto de cambio
// CP-1, cuatro intermedias en la armada 2 y cierre en BM-1 con +1.3 mm. -------

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

const BM = 100.0;
const TRUE_ELEVATIONS = [
  100.6102, 100.5857, 100.5313, 100.4961, 100.454, 100.5189, 100.5626, 100.6014,
];
const CP = 100.34;
const AI1 = BM + 1.425;
const AI2 = CP + 1.51;

function prototypeBook(): BookRow[] {
  const fs = (ai: number, cota: number) => Number((ai - cota).toFixed(4));
  return [
    row("BM-1", "bm", 1.425, null, 40, null),
    ...[0, 1, 2, 3].map((k) =>
      row(`PC-0${k + 1}`, "intermediate", null, fs(AI1, TRUE_ELEVATIONS[k]!)),
    ),
    row("CP-1", "pc", 1.51, fs(AI1, CP), 45, 42),
    ...[4, 5, 6, 7].map((k) =>
      row(`PC-0${k + 1}`, "intermediate", null, fs(AI2, TRUE_ELEVATIONS[k]!)),
    ),
    row("BM-1", "bm", null, fs(AI2, BM + 0.0013), null, 38),
  ];
}

function point(code: string, extra: Partial<PointInput> = {}): PointInput {
  return {
    id: code.toLowerCase(),
    code,
    initialElevation: null,
    activeFrom: null,
    retiredOn: null,
    ...extra,
  };
}

const POINTS = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => point(`PC-0${k}`));

describe("computeVisitBook", () => {
  it("calcula la libreta del prototipo como circuito cerrado sobre el amarre", () => {
    const r = computeVisitBook(prototypeBook(), BM, "tercer_orden");
    expect(r.arithmeticCheckOk).toBe(true);
    expect(r.sumBacksights).toBeCloseTo(2.935, 4);
    expect(r.sumForesights).toBeCloseTo(2.9337, 4);
    expect(r.closureErrorMm).toBeCloseTo(1.3, 6);
    expect(r.toleranceMm).toBeCloseTo(4.87, 2);
    expect(r.meetsTolerance).toBe(true);
    expect(r.return).toBeNull();
  });

  it("el amarre no se compensa y el punto de cambio se compensa hasta su V− (Fase 19)", () => {
    const r = computeVisitBook(prototypeBook(), BM, "tercer_orden");
    const amarre = r.forward.readings[0]!;
    expect(amarre.correctionApplied).toBe(0);
    expect(amarre.elevationCorrected).toBe(BM);
    // CP-1 está a 40 + 42 m del origen, no a 40 + 42 + 45.
    expect(r.forward.readings[5]!.distanceAccumulatedKm).toBeCloseTo(0.082, 9);
  });

  it("las intermedias heredan el acumulado de su armada: sus cotas no cambian (Fase 19)", () => {
    const r = computeVisitBook(prototypeBook(), BM, "tercer_orden");
    const acc = r.forward.readings.map((x) => x.distanceAccumulatedKm);
    // Armada 1 hasta el instrumento: 40 m. Armada 2: 40 + 42 + 45 m. Es lo
    // mismo que daba la regla anterior, así que las cotas derivadas de los
    // puntos de control no se mueven.
    for (const k of [1, 2, 3, 4]) expect(acc[k]).toBeCloseTo(0.04, 9);
    for (const k of [6, 7, 8, 9]) expect(acc[k]).toBeCloseTo(0.127, 9);
    const pc05 = r.forward.readings[6]!;
    expect(pc05.correctionApplied).toBeCloseTo((-0.0013 * 127) / 165, 9);
    // El cierre recibe la corrección entera y vuelve a la cota del amarre.
    expect(r.forward.readings[10]!.elevationCorrected).toBeCloseTo(BM, 9);
  });

  it("sin distancias calcula el cierre pero no la tolerancia ni la compensación", () => {
    const rows = prototypeBook().map((x) => ({
      ...x,
      backDistanceM: null,
      foreDistanceM: null,
    }));
    const r = computeVisitBook(rows, BM, "tercer_orden");
    expect(r.closureErrorMm).toBeCloseTo(1.3, 6);
    expect(r.toleranceMm).toBeNull();
    expect(r.meetsTolerance).toBeNull();
    const pc05 = r.forward.readings.find((x) => x.pointCode === "PC-05")!;
    expect(pc05.elevationCorrected).toBe(pc05.elevationCalculated);
  });
});

describe("computeVisitBook — libreta a medias", () => {
  it("sin la V− de cierre no calcula cierre ni compensa", () => {
    const rows = prototypeBook();
    rows[rows.length - 1] = row("BM-1", "bm", null, null);
    const r = computeVisitBook(rows, BM, "tercer_orden");
    expect(r.closureErrorMm).toBeNull();
    expect(r.toleranceMm).toBeNull();
    expect(r.meetsTolerance).toBeNull();
    const pc01 = r.forward.readings.find((x) => x.pointCode === "PC-01")!;
    expect(pc01.elevationCorrected).toBe(pc01.elevationCalculated);
  });
});

describe("deriveControlElevations", () => {
  const DATE = "2025-03-10";

  it("toma la cota compensada de cada punto, redondeada a 4 decimales", () => {
    const r = computeVisitBook(prototypeBook(), BM, "tercer_orden");
    const { readings, issues } = deriveControlElevations(r, POINTS, DATE);
    expect(issues).toEqual([]);
    expect(readings).toHaveLength(8);
    const byId = Object.fromEntries(readings.map((x) => [x.pointId, x]));
    // Armada 1: 0.040 km acumulados; armada 2: 0.127 km.
    expect(byId["pc-01"]!.elevation).toBe(100.6099);
    expect(byId["pc-05"]!.elevation).toBe(100.453);
    expect(byId["pc-01"]!.rowIndex).toBe(1);
    expect(byId["pc-08"]!.rowIndex).toBe(9);
    for (const x of readings) {
      expect(Number(x.elevation.toFixed(4))).toBe(x.elevation);
    }
  });

  it("fuera de tolerancia usa la cota calculada, sin error", () => {
    const rows = prototypeBook();
    // Cierre de +40 mm, muy por encima de los 4.87 mm de tolerancia.
    rows[rows.length - 1] = row(
      "BM-1",
      "bm",
      null,
      Number((AI2 - BM - 0.04).toFixed(4)),
      null,
      38,
    );
    const r = computeVisitBook(rows, BM, "tercer_orden");
    expect(r.meetsTolerance).toBe(false);
    const { readings, issues } = deriveControlElevations(r, POINTS, DATE);
    expect(issues).toEqual([]);
    expect(readings.find((x) => x.pointId === "pc-05")!.elevation).toBe(100.454);
  });

  it("un punto de control usado como punto de cambio también da su cota", () => {
    const rows = prototypeBook().map((x) =>
      x.pointCode === "CP-1" ? { ...x, pointCode: "PC-09" } : x,
    );
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const { readings } = deriveControlElevations(
      r,
      [...POINTS, point("PC-09")],
      DATE,
    );
    expect(readings.find((x) => x.pointId === "pc-09")).toMatchObject({
      rowIndex: 5,
    });
  });

  it("el mismo punto con V− en dos filas es un error y no da cota", () => {
    const rows = prototypeBook();
    rows.splice(9, 0, row("pc-03 ", "intermediate", null, 1.4));
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const { readings, issues } = deriveControlElevations(r, POINTS, DATE);
    expect(issues).toContainEqual({
      kind: "duplicate",
      level: "error",
      pointId: "pc-03",
      code: "PC-03",
      rows: [3, 9],
    });
    expect(readings.find((x) => x.pointId === "pc-03")).toBeUndefined();
  });

  it("un punto no vigente en la fecha avisa y no da cota", () => {
    const points = POINTS.map((p) =>
      p.code === "PC-02"
        ? { ...p, retiredOn: "2025-03-01" }
        : p.code === "PC-07"
          ? { ...p, activeFrom: "2025-04-01" }
          : p,
    );
    const r = computeVisitBook(prototypeBook(), BM, "tercer_orden");
    const { readings, issues } = deriveControlElevations(r, points, DATE);
    expect(readings.map((x) => x.pointId)).not.toContain("pc-02");
    expect(readings.map((x) => x.pointId)).not.toContain("pc-07");
    expect(issues).toEqual([
      { kind: "inactive", level: "warning", pointId: "pc-02", code: "PC-02", row: 2 },
      { kind: "inactive", level: "warning", pointId: "pc-07", code: "PC-07", row: 8 },
    ]);
  });

  it("un punto vigente que falta en la libreta avisa", () => {
    const rows = prototypeBook().filter((x) => x.pointCode !== "PC-04");
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const { issues } = deriveControlElevations(r, POINTS, DATE);
    expect(issues).toEqual([
      { kind: "missing", level: "warning", pointId: "pc-04", code: "PC-04" },
    ]);
  });

  it("un código que no es punto de control es una radiación normal", () => {
    const rows = prototypeBook();
    rows.splice(2, 0, row("AUX-1", "intermediate", null, 1.2));
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const { readings, issues } = deriveControlElevations(r, POINTS, DATE);
    expect(issues).toEqual([]);
    expect(readings).toHaveLength(8);
  });

  it("empareja los códigos sin distinguir espacios ni mayúsculas", () => {
    const rows = prototypeBook().map((x) =>
      x.pointCode === "PC-06" ? { ...x, pointCode: "pc- 06" } : x,
    );
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const { readings } = deriveControlElevations(r, POINTS, DATE);
    expect(readings.find((x) => x.pointId === "pc-06")).toBeDefined();
  });
});

describe("buildBookTemplate", () => {
  const DATE = "2025-03-10";

  it("sin libreta anterior: amarre, puntos vigentes como intermedias y amarre", () => {
    const points = [point("PC-10"), point("PC-2"), point("PC-1", { retiredOn: "2025-01-01" })];
    expect(buildBookTemplate(null, points, DATE, "BM-1")).toEqual([
      { pointCode: "BM-1", pointType: "bm" },
      { pointCode: "PC-2", pointType: "intermediate" },
      { pointCode: "PC-10", pointType: "intermediate" },
      { pointCode: "BM-1", pointType: "bm" },
    ]);
  });

  it("desde la libreta anterior, con el amarre de esta visita", () => {
    const previous = prototypeBook().map((x) => ({
      pointCode: x.pointCode,
      pointType: x.pointType,
    }));
    const t = buildBookTemplate(previous, POINTS, DATE, "BM-2");
    expect(t[0]).toEqual({ pointCode: "BM-2", pointType: "bm" });
    expect(t.at(-1)).toEqual({ pointCode: "BM-2", pointType: "bm" });
    expect(t.map((x) => x.pointCode).slice(1, -1)).toEqual([
      "PC-01", "PC-02", "PC-03", "PC-04", "CP-1", "PC-05", "PC-06", "PC-07", "PC-08",
    ]);
    expect(t.find((x) => x.pointCode === "CP-1")!.pointType).toBe("pc");
  });

  it("sin amarre elegido conserva el de la libreta anterior", () => {
    const previous = [
      { pointCode: "BM-1", pointType: "bm" as const },
      { pointCode: "PC-01", pointType: "intermediate" as const },
      { pointCode: "BM-1", pointType: "bm" as const },
    ];
    const t = buildBookTemplate(previous, [point("PC-01")], DATE, "  ");
    expect(t[0]!.pointCode).toBe("BM-1");
  });

  it("quita los puntos dados de baja y añade los dados de alta antes del cierre", () => {
    const previous = [
      { pointCode: "BM-1", pointType: "bm" as const },
      { pointCode: "PC-01", pointType: "intermediate" as const },
      { pointCode: "PC-02", pointType: "intermediate" as const },
      { pointCode: "BM-1", pointType: "bm" as const },
    ];
    const points = [
      point("PC-01"),
      point("PC-02", { retiredOn: "2025-03-01" }),
      point("PC-03", { activeFrom: "2025-03-10" }),
      point("PC-04", { activeFrom: "2025-04-01" }),
    ];
    expect(buildBookTemplate(previous, points, DATE, "BM-1")).toEqual([
      { pointCode: "BM-1", pointType: "bm" },
      { pointCode: "PC-01", pointType: "intermediate" },
      { pointCode: "PC-03", pointType: "intermediate" },
      { pointCode: "BM-1", pointType: "bm" },
    ]);
  });

  it("una libreta anterior de menos de dos filas se ignora", () => {
    const t = buildBookTemplate(
      [{ pointCode: "BM-1", pointType: "bm" }],
      [point("PC-01")],
      DATE,
      "BM-1",
    );
    expect(t).toHaveLength(3);
  });
});

// --- Estabilidad de los BMs (Fase 30) -----------------------------------------
// La libreta del prototipo con su punto de cambio renombrado BM-2: un BM de
// control. Su cota calculada es exactamente CP (100.3400) y su distancia
// acumulada, 40 + 42 m = 0.082 km: la tolerancia de tercer orden es
// 12·√0.082 = 3.44 mm.

function bookThroughBm2(): BookRow[] {
  return prototypeBook().map((r) => (r.pointCode === "CP-1" ? { ...r, pointCode: "BM-2" } : r));
}

/** La cota de catálogo de BM-2 en la fila del punto de cambio; null en las demás. */
function catalogAtBm2(rows: BookRow[], elevation: number): (number | null)[] {
  return rows.map((r) => (r.pointCode === "BM-2" ? elevation : null));
}

/** Amarre BM-1, BM-2 como punto de cambio a 0.25 km del amarre y cierre en BM-1. */
function shortBook(bm2Elevation: number, withDistances = true): BookRow[] {
  const d = (m: number) => (withDistances ? m : null);
  const fsBm2 = Number((1.5 - (bm2Elevation - BM)).toFixed(4));
  return [
    row("BM-1", "bm", 1.5, null, d(100), null),
    row("BM-2", "pc", 1.4, fsBm2, d(100), d(150)),
    row("BM-1", "bm", null, Number((1.4 + bm2Elevation - BM).toFixed(4)), null, d(150)),
  ];
}

describe("checkBenchmarks", () => {
  it("un BM que nivela con el amarre: diferencia, tolerancia K·√L y cumple", () => {
    const rows = bookThroughBm2();
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const [check, ...rest] = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.3412), "tercer_orden");
    expect(rest).toEqual([]);
    expect(check).toMatchObject({ rowIndex: 5, code: "BM-2", catalogElevation: 100.3412, measuredElevation: 100.34 });
    expect(check!.differenceMm).toBeCloseTo(-1.2, 9);
    expect(check!.toleranceMm).toBeCloseTo(12 * Math.sqrt(0.082), 9);
    expect(check!.meetsTolerance).toBe(true);
  });

  it("un BM que no nivela, por encima o por debajo de su cota de catálogo", () => {
    const rows = bookThroughBm2();
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const arriba = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.335), "tercer_orden")[0]!;
    expect(arriba.differenceMm).toBeCloseTo(5.0, 9);
    expect(arriba.meetsTolerance).toBe(false);
    const abajo = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.345), "tercer_orden")[0]!;
    expect(abajo.differenceMm).toBeCloseTo(-5.0, 9);
    expect(abajo.meetsTolerance).toBe(false);
  });

  it("compara la cota calculada, no la compensada", () => {
    const rows = bookThroughBm2();
    const r = computeVisitBook(rows, BM, "tercer_orden");
    // El cierre de +1.3 mm se compensa: la cota corregida de BM-2 se mueve, la
    // calculada no.
    expect(r.forward.readings[5]!.elevationCorrected).not.toBeCloseTo(100.34, 5);
    const check = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.34), "tercer_orden")[0]!;
    expect(check.differenceMm).toBe(0);
  });

  it("en la frontera exacta de la tolerancia cumple, y 0.1 mm más allá no", () => {
    // L = 0.25 km: tolerancia de tercer orden 12·√0.25 = 6.0 mm.
    const enFrontera = shortBook(100.506);
    const r1 = computeVisitBook(enFrontera, BM, "tercer_orden");
    const c1 = checkBenchmarks(r1.forward.readings, catalogAtBm2(enFrontera, 100.5), "tercer_orden")[0]!;
    expect(c1.toleranceMm).toBeCloseTo(6.0, 9);
    expect(c1.differenceMm).toBeCloseTo(6.0, 9);
    expect(c1.meetsTolerance).toBe(true);

    const fuera = shortBook(100.5061);
    const r2 = computeVisitBook(fuera, BM, "tercer_orden");
    const c2 = checkBenchmarks(r2.forward.readings, catalogAtBm2(fuera, 100.5), "tercer_orden")[0]!;
    expect(c2.differenceMm).toBeCloseTo(6.1, 9);
    expect(c2.meetsTolerance).toBe(false);
  });

  it("sin distancias da la diferencia, sin tolerancia ni veredicto", () => {
    const rows = shortBook(100.502, false);
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const check = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.5), "tercer_orden")[0]!;
    expect(check.differenceMm).toBeCloseTo(2.0, 9);
    expect(check.toleranceMm).toBeNull();
    expect(check.meetsTolerance).toBeNull();
  });

  it("solo comprueba las filas con cota de catálogo y vista menos", () => {
    const rows = bookThroughBm2();
    const r = computeVisitBook(rows, BM, "tercer_orden");
    // El amarre (fila 0) no tiene V−: aunque traiga cota, no se comprueba.
    const catalog = rows.map((_, i) => (i === 0 ? 100 : null));
    expect(checkBenchmarks(r.forward.readings, catalog, "tercer_orden")).toEqual([]);
  });

  it("el mismo BM leído dos veces da dos comprobaciones, en el orden de la libreta", () => {
    const rows = bookThroughBm2();
    rows[2] = { ...rows[2]!, pointCode: "BM-2" };
    const r = computeVisitBook(rows, BM, "tercer_orden");
    const checks = checkBenchmarks(r.forward.readings, catalogAtBm2(rows, 100.34), "tercer_orden");
    expect(checks.map((c) => c.rowIndex)).toEqual([2, 5]);
  });
});

describe("catalogElevationsOf", () => {
  const catalog = [
    { code: "BM-1", type: "bm" as const, elevation: 100 },
    // PostgREST entrega los DECIMAL como cadena.
    { code: "BM-2", type: "bm" as const, elevation: "100.8450" as unknown as number },
    { code: "BM-3", type: "bm" as const, elevation: null },
    { code: "GPS-1", type: "gps" as const, elevation: 101.2 },
    { code: "PC-01", type: "bm" as const, elevation: 100.61 },
  ];
  const lectura = (code: string, foresight: number | null = 1.2) => ({ pointCode: code, foresight });

  it("da la cota del catálogo a la fila de otro BM con vista menos", () => {
    expect(catalogElevationsOf([lectura("BM-2"), lectura(" bm-2 ")], catalog, "BM-1", POINTS)).toEqual([
      100.845, 100.845,
    ]);
  });

  it("no la da al amarre, a un BM sin cota, a un punto que no es BM ni a una fila sin vista menos", () => {
    expect(
      catalogElevationsOf(
        [lectura("BM-1"), lectura("BM-3"), lectura("GPS-1"), lectura("BM-2", null), lectura("CP-1")],
        catalog,
        "BM-1",
        POINTS,
      ),
    ).toEqual([null, null, null, null, null]);
  });

  it("un código que también es punto de control es punto de control", () => {
    expect(catalogElevationsOf([lectura("PC-01")], catalog, "BM-1", POINTS)).toEqual([null]);
  });
});
