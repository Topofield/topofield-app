import { describe, expect, it } from "vitest";
import {
  chainedMeans,
  nextAccumulatedThreshold,
  summarizeSite,
  summarizeVisit,
} from "./settlement-summary";
import type {
  ComputedReading,
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

describe("summarizeSite", () => {
  const history: SettlementHistory = {
    visits: [
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
      visit(1, "2025-02-01", [reading("a", -5, -5, -4.9), reading("b", -28, -28, -27.5, "alarm")], "alarm"),
      // Un alta: «c» entra con su primera lectura y acumulado 0.
      visit(2, "2025-03-01", [reading("a", -8, -3, -3.1, "caution"), reading("b", -30, -2, -2), reading("c", 0, null, null)], "caution"),
    ],
    trends: {},
  };

  it("resume el lugar con la última visita y el histórico", () => {
    const s = summarizeSite(history);
    expect(s.visits).toHaveLength(3);
    expect(s.latest!.visitId).toBe("v2");
    expect(s.baseDate).toBe("2025-01-01");
    expect(s.lastDate).toBe("2025-03-01");
    expect(s.visitsInAlert).toBe(2);
    // El promedio es el encadenado (Fase 31, D-8): «c» entra de alta en la
    // visita 2 y no tira del promedio hacia 0. La media de acumulados daba
    // −38/3 = −12.67.
    expect(s.latest!.mean).toBeCloseTo(-19, 9);
  });

  it("un lugar sin visitas no tiene resumen", () => {
    const s = summarizeSite({ visits: [], trends: {} });
    expect(s.latest).toBeNull();
    expect(s.baseDate).toBeNull();
    expect(s.lastDate).toBeNull();
    expect(s.visitsInAlert).toBe(0);
  });
});

describe("chainedMeans (Fase 31, D-8)", () => {
  it("sin altas ni bajas es la media de los acumulados", () => {
    const means = chainedMeans([
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
      visit(1, "2025-02-01", [reading("a", -5, -5, -5), reading("b", -9, -9, -9)]),
      visit(2, "2025-03-01", [reading("a", -8, -3, -3), reading("b", -10, -1, -1)]),
    ]);
    expect(means[0]).toBeCloseTo(0, 9);
    expect(means[1]).toBeCloseTo(-7, 9);
    expect(means[2]).toBeCloseTo(-9, 9);
  });

  it("un alta no tira del promedio: entra en la cadena desde su segunda lectura", () => {
    const means = chainedMeans([
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
      visit(1, "2025-02-01", [reading("a", -5, -5, -5), reading("b", -28, -28, -28)]),
      visit(2, "2025-03-01", [reading("a", -8, -3, -3), reading("b", -30, -2, -2), reading("c", 0, null, null)]),
    ]);
    // Visita 2: −16.5 más la media de los parciales de «a» y «b», −2.5.
    expect(means[2]).toBeCloseTo(-19, 9);
  });

  it("una baja tampoco: el promedio sigue con los puntos que quedan", () => {
    const means = chainedMeans([
      visit(0, "2025-01-01", [reading("a", 0, null, null), reading("b", 0, null, null)]),
      visit(1, "2025-02-01", [reading("a", -2, -2, -2), reading("b", -20, -20, -20)]),
      // «b», el que más bajaba, se da de baja: la media de acumulados saltaría
      // de −11 a −3.
      visit(2, "2025-03-01", [reading("a", -3, -1, -1)]),
    ]);
    expect(means[2]).toBeCloseTo(-12, 9);
  });

  it("una visita sin lecturas no tiene promedio, y la siguiente se encadena con la anterior que sí", () => {
    const means = chainedMeans([
      visit(0, "2025-01-01", [reading("a", 0, null, null)]),
      visit(1, "2025-02-01", []),
      visit(2, "2025-03-01", [reading("a", -4, -4, -2)]),
    ]);
    expect(means[1]).toBeNull();
    expect(means[2]).toBeCloseTo(-4, 9);
  });

  it("sin ningún punto en común con la anterior, la cadena se reinicia con la media de acumulados", () => {
    const means = chainedMeans([
      visit(0, "2025-01-01", [reading("a", 0, null, null)]),
      visit(1, "2025-02-01", [reading("b", -6, null, null), reading("c", -2, null, null)]),
    ]);
    expect(means[1]).toBeCloseTo(-4, 9);
  });

  it("arranca en la media de acumulados de la primera visita, aunque no sea cero", () => {
    // Una C0 de otra medición: la visita 0 ya muestra lo que se movió.
    const means = chainedMeans([visit(0, "2025-01-01", [reading("a", -3, null, null), reading("b", -1, null, null)])]);
    expect(means[0]).toBeCloseTo(-2, 9);
  });
});

describe("nextAccumulatedThreshold", () => {
  const T = { caution: 25, alert: 50, alarm: 75 };

  it("dice cuánto falta para el siguiente umbral", () => {
    expect(nextAccumulatedThreshold(-18.5, T)).toEqual({
      kind: "below",
      level: "caution",
      thresholdMm: 25,
      remainingMm: 6.5,
    });
    expect(nextAccumulatedThreshold(-30, T)).toMatchObject({ level: "alert", remainingMm: 20 });
  });

  it("la frontera cuenta como alcanzada, como en la clasificación", () => {
    expect(nextAccumulatedThreshold(-25, T)).toMatchObject({ level: "alert", remainingMm: 25 });
    expect(nextAccumulatedThreshold(-75, T)).toEqual({ kind: "beyondAlarm", thresholdMm: 75 });
  });

  it("un levantamiento se mide en valor absoluto", () => {
    expect(nextAccumulatedThreshold(10, T)).toMatchObject({ level: "caution", remainingMm: 15 });
  });
});
