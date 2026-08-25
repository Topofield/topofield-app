import { describe, expect, it } from "vitest";
import {
  computeSettlements,
  daysBetween,
  monthsBetween,
} from "./settlement";
import type { PointInput, VisitInput } from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  northing: 0,
  easting: 0,
  initialElevation: 100.0,
};

/** Construye una visita con una sola lectura de P1. */
function visita(n: number, date: string, elevation: number): VisitInput {
  return {
    id: `v${n}`,
    visitNumber: n,
    date,
    readings: [{ pointId: "p1", elevation }],
  };
}

describe("daysBetween", () => {
  it("cuenta los días entre dos fechas ISO", () => {
    expect(daysBetween("2025-01-15", "2025-02-15")).toBe(31);
    expect(daysBetween("2025-02-15", "2025-03-15")).toBe(28);
    expect(daysBetween("2025-05-15", "2025-07-15")).toBe(61);
  });

  it("no se descuadra al cruzar un cambio de horario", () => {
    // Bogotá no tiene DST, pero el cálculo debe ser en UTC de todos modos.
    expect(daysBetween("2025-03-01", "2025-04-01")).toBe(31);
  });
});

describe("monthsBetween", () => {
  it("convierte días a meses con 30.4375 días por mes", () => {
    expect(monthsBetween("2025-01-15", "2025-02-15")).toBeCloseTo(
      31 / 30.4375,
      10,
    );
  });
});

describe("computeSettlements — parcial y acumulado", () => {
  it("la línea base no tiene parcial ni velocidad, y su acumulado es 0", () => {
    const r = computeSettlements([P1], [visita(0, "2025-01-15", 100.0)]);
    expect(r[0]?.readings[0]?.partialSettlement).toBeNull();
    expect(r[0]?.readings[0]?.velocity).toBeNull();
    expect(r[0]?.readings[0]?.accumulatedSettlement).toBe(0);
  });

  it("calcula parcial contra la visita anterior y acumulado contra C0", () => {
    const r = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.9942),
        visita(2, "2025-03-15", 99.9891),
      ],
    );
    // (99.9942 − 100.0) × 1000 = −5.8
    expect(r[1]?.readings[0]?.partialSettlement).toBeCloseTo(-5.8, 6);
    expect(r[1]?.readings[0]?.accumulatedSettlement).toBeCloseTo(-5.8, 6);
    // (99.9891 − 99.9942) × 1000 = −5.1 ; acumulado −10.9
    expect(r[2]?.readings[0]?.partialSettlement).toBeCloseTo(-5.1, 6);
    expect(r[2]?.readings[0]?.accumulatedSettlement).toBeCloseTo(-10.9, 6);
  });

  it("conserva el signo: un levantamiento es positivo, no valor absoluto", () => {
    const r = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 100.003)],
    );
    expect(r[1]?.readings[0]?.partialSettlement).toBeCloseTo(3.0, 6);
    expect(r[1]?.readings[0]?.accumulatedSettlement).toBeCloseTo(3.0, 6);
  });

  it("deja el acumulado en null si el punto no tiene C0", () => {
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r = computeSettlements(
      [sinC0],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 99.99)],
    );
    expect(r[1]?.readings[0]?.accumulatedSettlement).toBeNull();
  });
});

describe("computeSettlements — velocidad", () => {
  // Los intervalos que el marco teórico calcula mal. Los valores esperados se
  // obtienen por cálculo directo: Δs / (días / 30.4375).
  it.each([
    { dias: 31, desde: "2025-01-15", hasta: "2025-02-15", ds: -5.8 },
    { dias: 28, desde: "2025-02-15", hasta: "2025-03-15", ds: -5.1 },
    { dias: 31, desde: "2025-03-15", hasta: "2025-04-15", ds: -3.9 },
    { dias: 30, desde: "2025-04-15", hasta: "2025-05-15", ds: -2.9 },
    { dias: 61, desde: "2025-05-15", hasta: "2025-07-15", ds: -1.9 },
    { dias: 92, desde: "2025-07-15", hasta: "2025-10-15", ds: -1.1 },
  ])(
    "con un intervalo de $dias días divide por los meses reales",
    ({ dias, desde, hasta, ds }) => {
      const cotaInicial = 100.0;
      const cotaFinal = cotaInicial + ds / 1000;
      const r = computeSettlements(
        [P1],
        [visita(0, desde, cotaInicial), visita(1, hasta, cotaFinal)],
      );
      const esperado = ds / (dias / (365.25 / 12));
      expect(r[1]?.readings[0]?.velocity).toBeCloseTo(esperado, 6);
    },
  );

  it("devuelve null —nunca Infinity ni NaN— si dos visitas caen el mismo día", () => {
    const r = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-01-15", 99.99)],
    );
    const v = r[1]?.readings[0]?.velocity;
    expect(v).toBeNull();
    expect(Number.isNaN(v as unknown as number)).toBe(false);
  });
});

describe("computeSettlements — orden", () => {
  it("ordena por fecha, no por visit_number", () => {
    // Una visita numerada 2 pero fechada antes que la 1: el parcial de cada una
    // debe calcularse contra la que realmente la precede en el tiempo.
    const r = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(2, "2025-03-15", 99.99),
        visita(1, "2025-02-15", 99.995),
      ],
    );
    // Ordenadas: v0 (100.0) → v1 (99.995) → v2 (99.99)
    expect(r.map((v) => v.visitNumber)).toEqual([0, 1, 2]);
    expect(r[1]?.readings[0]?.partialSettlement).toBeCloseTo(-5.0, 6);
    expect(r[2]?.readings[0]?.partialSettlement).toBeCloseTo(-5.0, 6);
  });

  it("un punto sin lectura en una visita no aparece en sus resultados", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "p1", elevation: 100.0 },
          { pointId: "p2", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p1", elevation: 99.99 }],
      },
    ];
    const r = computeSettlements([P1, P2], visitas);
    expect(r[1]?.readings).toHaveLength(1);
    expect(r[1]?.readings[0]?.pointId).toBe("p1");
  });

  it("mide el parcial contra la última visita que sí midió ese punto", () => {
    // P1 se mide en v0 y v2, pero no en v1. Su parcial en v2 debe compararse
    // contra v0, no contra una visita donde no hay dato.
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "p1", elevation: 100.0 },
          { pointId: "p2", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [{ pointId: "p2", elevation: 99.998 }],
      },
      {
        id: "v2",
        visitNumber: 2,
        date: "2025-03-15",
        readings: [{ pointId: "p1", elevation: 99.994 }],
      },
    ];
    const r = computeSettlements([P1, P2], visitas);
    const p1EnV2 = r[2]!.readings.find((x) => x.pointId === "p1")!;
    expect(p1EnV2.partialSettlement).toBeCloseTo(-6.0, 6);
    // Y la velocidad usa el intervalo real v0→v2 (59 días), no v1→v2.
    expect(p1EnV2.velocity).toBeCloseTo(-6.0 / (59 / (365.25 / 12)), 6);
  });
});
