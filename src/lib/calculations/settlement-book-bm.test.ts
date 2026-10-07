import { describe, expect, it } from "vitest";
import { bookBenchmarkChecks, computeBook, type BookRowInput } from "./settlement-book";
import { computeSettlements, detectTrendDeviations } from "./settlement";
import { trendDeviationMargin } from "./tolerances";
import type { PointType } from "@/types/leveling";

function r(pointCode: string, pointType: PointType, backsight: number | null, foresight: number | null,
  bd: number | null = null, fd: number | null = null, startsSection = false): BookRowInput {
  return { pointCode, pointType, backsight, foresight, backUpperM: null, backLowerM: null,
    foreUpperM: null, foreLowerM: null, backDistanceM: bd, foreDistanceM: fd, distanceAccumulatedKm: null, startsSection };
}
const BMS = [{ code: "BM-1", elevation: 100 }, { code: "BM-2", elevation: 100.845 }];
const rows = [
  r("BM-1", "bm", 1.8637, null, 28.363, null, true),
  r("BM-2", "intermediate", null, 1.0191),
  r("TA-01", "intermediate", null, 1.2682),
  r("CP-1", "pc", 0.6263, 1.2152, 28.207, 27.818),
  r("BM-1", "bm", null, 1.2764, null, 28.27),
];

describe("un BM del lugar leído de paso", () => {
  it("se compara con su cota del lugar en tercer orden; el BM de cierre no", () => {
    const checks = bookBenchmarkChecks(computeBook(rows, BMS), rows, BMS, [{ code: "TA-01" }]);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ rowIndex: 1, code: "BM-2", catalogElevation: 100.845, measuredElevation: 100.8446, differenceMm: -0.4, meetsTolerance: true });
  });
});

describe("el margen fijo de la tendencia", () => {
  it("son 6 mm entre dos visitas, sin orden ni circuito", () => {
    expect(trendDeviationMargin()).toBe(6);
  });

  it("B10 de la cartera: «excesiva» en la visita 3 y «contraria» en la 4", () => {
    const dates = ["2022-03-24", "2022-03-31", "2022-04-12", "2022-04-19"];
    const cotas = [153.689, 153.679, 153.629, 153.674];
    const visits = dates.map((date, i) => ({ id: `v${i + 1}`, visitNumber: i + 1, date, readings: [{ pointId: "B10", elevation: cotas[i]! }] }));
    const dev = detectTrendDeviations(
      computeSettlements([{ id: "B10", code: "B10", initialElevation: null, activeFrom: null, retiredOn: null }], visits),
    );
    expect(dev.get("v3")?.get("B10")).toMatchObject({ kind: "excessive", partialMm: -50, expectedMm: 17.1, marginMm: 6 });
    expect(dev.get("v4")?.get("B10")).toMatchObject({ kind: "contrary", partialMm: 45 });
  });
});
