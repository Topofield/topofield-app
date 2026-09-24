import { describe, expect, it } from "vitest";
import { summarizeSite, summarizeVisit } from "./settlement-summary";
import type {
  ComputedReading,
  DifferentialPair,
  SettlementHistory,
  VisitResult,
} from "@/types/settlement";

function reading(
  pointId: string,
  accumulated: number,
  partial: number | null,
  velocity: number | null,
  alertStatus: ComputedReading["alertStatus"] = "normal",
): ComputedReading {
  return {
    pointId,
    elevation: 100 + accumulated / 1000,
    partialSettlement: partial,
    accumulatedSettlement: accumulated,
    velocity,
    alertStatus,
    baselineDate: "2025-01-01",
    baselineElevation: 100,
  };
}

function visit(
  n: number,
  date: string,
  readings: ComputedReading[],
  worstAlert: VisitResult["worstAlert"] = "normal",
): VisitResult {
  return { visitId: `v${n}`, visitNumber: n, date, readings, worstAlert };
}

describe("summarizeVisit", () => {
  it("resume una visita con sus extremos, su promedio y sus alertas", () => {
    const s = summarizeVisit(
      visit(
        2,
        "2025-03-01",
        [
          reading("a", -10, -2, -1.5),
          reading("b", -30, -4.5, -3.2, "caution"),
          reading("c", -20, 1, 0.8),
        ],
        "caution",
      ),
    );
    expect(s.readingCount).toBe(3);
    expect(s.maxSettlement).toEqual({ pointId: "b", value: -30 });
    expect(s.mean).toBeCloseTo(-20, 9);
    expect(s.min).toBe(-30);
    expect(s.max).toBe(-10);
    expect(s.maxMove).toEqual({ pointId: "b", value: -4.5 });
    expect(s.maxVelocity).toEqual({ pointId: "b", value: -3.2 });
    expect(s.alertCount).toBe(1);
    expect(s.worstAlert).toBe("caution");
  });

  it("un levantamiento mayor que cualquier descenso es el asentamiento máximo, con su signo", () => {
    const s = summarizeVisit(
      visit(1, "2025-02-01", [reading("a", -3, -3, -3), reading("b", 7, 7, 7)]),
    );
    expect(s.maxSettlement).toEqual({ pointId: "b", value: 7 });
  });

  it("la visita base no tiene movimiento ni velocidad", () => {
    const s = summarizeVisit(
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
    );
    expect(s.mean).toBe(0);
    expect(s.maxMove).toBeNull();
    expect(s.maxVelocity).toBeNull();
  });

  it("una visita sin lecturas no tiene extremos ni promedio", () => {
    const s = summarizeVisit(visit(3, "2025-04-01", []));
    expect(s.readingCount).toBe(0);
    expect(s.maxSettlement).toBeNull();
    expect(s.mean).toBeNull();
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
  });
});

function pair(a: string, b: string, inverse: number, exceeds = false): DifferentialPair {
  return {
    pointIdA: a,
    pointIdB: b,
    differentialMm: 5,
    settlementAMm: -10,
    settlementBMm: -15,
    sinceDate: "2025-01-01",
    distanceM: 10,
    distortionInverse: inverse,
    exceedsLimit: exceeds,
  };
}

describe("summarizeSite", () => {
  const history: SettlementHistory = {
    visits: [
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
      visit(1, "2025-02-01", [reading("a", -5, -5, -4.9), reading("b", -28, -28, -27.5, "alarm")], "alarm"),
      // Un alta: «c» entra con su primera lectura y acumulado 0.
      visit(2, "2025-03-01", [reading("a", -8, -3, -3.1, "caution"), reading("b", -30, -2, -2), reading("c", 0, null, null)], "caution"),
    ],
    differentials: [pair("a", "b", 2000), pair("a", "c", 400, true), pair("b", "c", Infinity)],
    trends: {},
  };

  it("resume el lugar con la última visita y el histórico", () => {
    const s = summarizeSite(history);
    expect(s.visits).toHaveLength(3);
    expect(s.latest!.visitId).toBe("v2");
    expect(s.baseDate).toBe("2025-01-01");
    expect(s.lastDate).toBe("2025-03-01");
    expect(s.visitsInAlert).toBe(2);
    expect(s.worstDistortion).toMatchObject({ pointIdA: "a", pointIdB: "c", distortionInverse: 400 });
    // El promedio mezcla líneas base cuando hay altas: se acepta (PRD, «KPIs»).
    expect(s.latest!.mean).toBeCloseTo(-38 / 3, 9);
  });

  it("un lugar sin visitas no tiene resumen", () => {
    const s = summarizeSite({ visits: [], differentials: [], trends: {} });
    expect(s.latest).toBeNull();
    expect(s.baseDate).toBeNull();
    expect(s.lastDate).toBeNull();
    expect(s.visitsInAlert).toBe(0);
    expect(s.worstDistortion).toBeNull();
  });

  it("si todos los pares se asientan igual, la peor distorsión es 1/∞", () => {
    const s = summarizeSite({ ...history, differentials: [pair("a", "b", Infinity)] });
    expect(s.worstDistortion!.distortionInverse).toBe(Infinity);
  });
});
