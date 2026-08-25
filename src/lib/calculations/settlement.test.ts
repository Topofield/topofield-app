import { describe, expect, it } from "vitest";
import {
  computeDifferentials,
  computeSettlements,
  daysBetween,
  horizontalDistance,
  monthsBetween,
} from "./settlement";
import type {
  ComputedReading,
  PointInput,
  VisitInput,
} from "@/types/settlement";

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

/** Lectura ya calculada, para probar los diferenciales aisladamente. */
function lectura(
  pointId: string,
  accumulated: number | null,
): ComputedReading {
  return {
    pointId,
    elevation: 100,
    partialSettlement: null,
    accumulatedSettlement: accumulated,
    velocity: null,
    alertStatus: "normal",
  };
}

const A: PointInput = {
  id: "a",
  code: "P-A",
  northing: 0,
  easting: 0,
  initialElevation: 100,
};
const B: PointInput = {
  id: "b",
  code: "P-B",
  northing: 0,
  easting: 6,
  initialElevation: 100,
};

describe("horizontalDistance", () => {
  it("es la distancia euclidiana en el plano N/E", () => {
    expect(horizontalDistance(A, B)).toBeCloseTo(6, 10);
    const C: PointInput = { ...A, id: "c", northing: 3, easting: 4 };
    expect(horizontalDistance(A, C)).toBeCloseTo(5, 10);
  });

  it("es null si a algún punto le faltan coordenadas", () => {
    const sinCoords: PointInput = { ...B, northing: null };
    expect(horizontalDistance(A, sinCoords)).toBeNull();
  });
});

describe("computeDifferentials", () => {
  it("calcula el diferencial y la distorsión como 1/X", () => {
    // Diferencial |−1.8 − (−2.5)| = 0.7 mm sobre 6 m ⇒ 6000/0.7 = 1/8571.4
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -1.8), lectura("b", -2.5)],
      500,
    );
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.differentialMm).toBeCloseTo(0.7, 6);
    expect(pairs[0]?.distanceM).toBeCloseTo(6, 6);
    expect(pairs[0]?.distortionInverse).toBeCloseTo(8571.43, 1);
    expect(pairs[0]?.exceedsLimit).toBe(false);
  });

  it("marca el par que supera el límite: 1/X con X MENOR que el límite", () => {
    // 20 mm sobre 6 m ⇒ 1/300, más severo que 1/500 ⇒ excede.
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", 0), lectura("b", -20)],
      500,
    );
    expect(pairs[0]?.distortionInverse).toBeCloseTo(300, 6);
    expect(pairs[0]?.exceedsLimit).toBe(true);
  });

  it("un diferencial de 0 da 1/∞ y NO excede el límite", () => {
    // Dos puntos que se asientan igual no tienen distorsión entre sí.
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", -5)],
      500,
    );
    expect(pairs[0]?.differentialMm).toBe(0);
    expect(pairs[0]?.distortionInverse).toBe(Number.POSITIVE_INFINITY);
    expect(pairs[0]?.exceedsLimit).toBe(false);
  });

  it("excluye el par si a un punto le faltan coordenadas", () => {
    // Calcularlo con L = 0 daría distorsión infinita y aparentaría normalidad.
    const sinCoords: PointInput = { ...B, easting: null };
    const pairs = computeDifferentials(
      [A, sinCoords],
      [lectura("a", 0), lectura("b", -20)],
      500,
    );
    expect(pairs).toHaveLength(0);
  });

  it("excluye el par si a un punto le falta el acumulado", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", null)],
      500,
    );
    expect(pairs).toHaveLength(0);
  });

  it("genera cada par una sola vez, sin repetir el simétrico", () => {
    const C: PointInput = { ...A, id: "c", easting: 12 };
    const pairs = computeDifferentials(
      [A, B, C],
      [lectura("a", -1), lectura("b", -2), lectura("c", -3)],
      500,
    );
    expect(pairs).toHaveLength(3); // a-b, a-c, b-c
  });

  it("el diferencial es siempre positivo, sea cual sea el orden", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", -1)],
      500,
    );
    expect(pairs[0]?.differentialMm).toBeCloseTo(4, 6);
  });
});
