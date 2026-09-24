import { describe, expect, it } from "vitest";
import {
  classifyAlert,
  classifyReadings,
  computeDifferentials,
  computeHistory,
  computeSettlements,
  computeTrends,
  daysBetween,
  detectTrendDeviations,
  horizontalDistance,
  isPointActiveOn,
  monthsBetween,
  pointInputOf,
} from "./settlement";
import { thresholdsFor, trendDeviationMargin } from "./tolerances";
import type { PrecisionOrder } from "@/types/project";
import type {
  ComputedReading,
  PointInput,
  Thresholds,
  VisitInput,
} from "@/types/settlement";

const P1: PointInput = {
  id: "p1",
  code: "P-01",
  northing: 0,
  easting: 0,
  initialElevation: 100.0,
  activeFrom: null,
  retiredOn: null,
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

  // Fase 11, decisión 1: sin C0, la línea base es la primera lectura. Hasta la
  // Fase 10 el acumulado quedaba en null y el punto nunca alertaba por
  // acumulado, sin que nada lo avisara.
  it("sin C0, mide el acumulado contra la primera lectura del punto", () => {
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r = computeSettlements(
      [sinC0],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 99.99)],
    );
    expect(r[0]?.readings[0]?.accumulatedSettlement).toBe(0);
    expect(r[1]?.readings[0]?.accumulatedSettlement).toBeCloseTo(-10.0, 6);
  });
});

describe("computeSettlements — línea base (Fase 11)", () => {
  const P7: PointInput = {
    ...P1,
    id: "p7",
    code: "P-07",
    initialElevation: null,
    activeFrom: "2025-03-15",
  };
  const visitas: VisitInput[] = [
    { id: "v0", visitNumber: 0, date: "2025-01-15", readings: [{ pointId: "p1", elevation: 100.0 }] },
    { id: "v1", visitNumber: 1, date: "2025-02-15", readings: [{ pointId: "p1", elevation: 99.995 }] },
    {
      id: "v2",
      visitNumber: 2,
      date: "2025-03-15",
      readings: [
        { pointId: "p1", elevation: 99.991 },
        { pointId: "p7", elevation: 101.2345 },
      ],
    },
    {
      id: "v3",
      visitNumber: 3,
      date: "2025-04-15",
      readings: [
        { pointId: "p1", elevation: 99.989 },
        { pointId: "p7", elevation: 101.2315 },
      ],
    },
  ];
  const r = computeSettlements([P1, P7], visitas);
  const de = (i: number, id: string) =>
    r[i]!.readings.find((x) => x.pointId === id)!;

  it("la primera lectura de un punto de alta es su visita 0", () => {
    expect(de(2, "p7").accumulatedSettlement).toBe(0);
    expect(de(2, "p7").partialSettlement).toBeNull();
    expect(de(2, "p7").velocity).toBeNull();
    expect(de(2, "p7").baselineDate).toBe("2025-03-15");
    expect(de(2, "p7").baselineElevation).toBe(101.2345);
  });

  it("las lecturas siguientes se miden contra esa primera lectura", () => {
    expect(de(3, "p7").accumulatedSettlement).toBeCloseTo(-3.0, 6);
  });

  it("un punto con C0 fecha su línea base en la primera visita del lugar", () => {
    expect(de(3, "p1").baselineDate).toBe("2025-01-15");
    expect(de(3, "p1").baselineElevation).toBe(100.0);
    expect(de(3, "p1").accumulatedSettlement).toBeCloseTo(-11.0, 6);
  });

  it("la línea base es la lectura más antigua por FECHA, no la primera capturada", () => {
    // La visita fechada antes llega al final del arreglo: el motor ordena.
    const sinC0: PointInput = { ...P1, initialElevation: null };
    const r2 = computeSettlements(
      [sinC0],
      [visita(1, "2025-02-15", 99.99), visita(0, "2025-01-15", 100.0)],
    );
    expect(r2[0]?.readings[0]?.accumulatedSettlement).toBe(0);
    expect(r2[1]?.readings[0]?.accumulatedSettlement).toBeCloseTo(-10.0, 6);
  });
});

describe("isPointActiveOn", () => {
  const original = { activeFrom: null, retiredOn: null };
  const alta = { activeFrom: "2025-03-15", retiredOn: null };
  const baja = { activeFrom: null, retiredOn: "2025-05-15" };

  it("un punto original sin baja está vigente siempre", () => {
    expect(isPointActiveOn(original, "1990-01-01")).toBe(true);
  });

  it("el alta es un límite inclusivo: la fecha de alta SÍ es vigente", () => {
    expect(isPointActiveOn(alta, "2025-03-14")).toBe(false);
    expect(isPointActiveOn(alta, "2025-03-15")).toBe(true);
    expect(isPointActiveOn(alta, "2025-03-16")).toBe(true);
  });

  it("la baja es un límite exclusivo: la fecha de baja ya NO es vigente", () => {
    expect(isPointActiveOn(baja, "2025-05-14")).toBe(true);
    expect(isPointActiveOn(baja, "2025-05-15")).toBe(false);
    expect(isPointActiveOn(baja, "2025-06-15")).toBe(false);
  });
});

describe("pointInputOf", () => {
  it("convierte los DECIMAL que PostgREST entrega como cadena y respeta los null", () => {
    const fila = {
      id: "p1",
      code: "P-01",
      northing: "2000.000" as unknown as number,
      easting: null,
      initial_elevation: "100.0000" as unknown as number,
      active_from: "2025-03-15",
      retired_on: null,
    };
    expect(pointInputOf(fila)).toEqual({
      id: "p1",
      code: "P-01",
      northing: 2000,
      easting: null,
      initialElevation: 100,
      activeFrom: "2025-03-15",
      retiredOn: null,
    });
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

describe("computeSettlements — visita intercalada (CRÍTICO 2, ronda de correcciones)", () => {
  // Reproduce el hallazgo: al intercalar una visita entre dos ya existentes,
  // la velocidad de la visita POSTERIOR cambia, porque ahora se mide contra
  // la visita intercalada (la nueva "última con lectura") y no contra la
  // anterior original. `saveVisitAction` debe detectar esta diferencia y
  // volver a persistir la visita posterior — si no lo hace, la base conserva
  // el valor viejo mientras el panel (que recalcula en cliente) ya muestra el
  // nuevo, y ambos divergen sin ningún error visible.
  it("la velocidad de la visita posterior cambia al intercalar una visita anterior", () => {
    const sinIntercalar = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-03-15", 99.994),
        visita(2, "2025-05-15", 99.988),
      ],
    );
    const velocidadOriginal = sinIntercalar[2]?.readings[0]?.velocity;
    expect(velocidadOriginal).toBeCloseTo(-2.9938524590163933, 6);

    const conIntercalada = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-03-15", 99.994),
        visita(3, "2025-04-15", 99.991), // intercalada entre v1 y v2
        visita(2, "2025-05-15", 99.988),
      ],
    );
    // v2 ahora se mide contra v3 (99.991, 2025-04-15), no contra v1: el
    // parcial pasa de −6 a −3 y la velocidad cambia de valor.
    const visitaPosterior = conIntercalada.find((v) => v.visitId === "v2");
    expect(visitaPosterior?.readings[0]?.partialSettlement).toBeCloseTo(
      -3.0,
      6,
    );
    const velocidadTrasIntercalar = visitaPosterior?.readings[0]?.velocity;
    expect(velocidadTrasIntercalar).toBeCloseTo(-3.04375, 6);
    expect(velocidadTrasIntercalar).not.toBeCloseTo(velocidadOriginal!, 2);
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
    // Misma línea base para todos: el caso de los puntos originales, donde el
    // diferencial es la diferencia de acumulados (Fase 5).
    baselineDate: "2025-01-15",
    baselineElevation: 100,
  };
}

/** Sin histórico: basta cuando todas las lecturas comparten línea base. */
const sinHistorico = () => undefined;

const A: PointInput = {
  id: "a",
  code: "P-A",
  northing: 0,
  easting: 0,
  initialElevation: 100,
  activeFrom: null,
  retiredOn: null,
};
const B: PointInput = {
  id: "b",
  code: "P-B",
  northing: 0,
  easting: 6,
  initialElevation: 100,
  activeFrom: null,
  retiredOn: null,
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
  // Distinto del caso «al punto le faltan coordenadas»: aquí el punto SÍ está
  // en el catálogo y con N/E, pero no se le midió en esta visita. No debe
  // aparecer en ningún par —no hay asentamiento que comparar— y sobre todo no
  // debe contarse como diferencial 0, que se leería como distorsión infinita,
  // es decir, como normalidad perfecta.
  it("excluye un punto del catálogo que no tiene lectura en la visita", () => {
    const C: PointInput = { id: "c", code: "P-C", northing: 0, easting: 12, initialElevation: 100, activeFrom: null, retiredOn: null };
    const pairs = computeDifferentials(
      [A, B, C],
      [lectura("a", -10), lectura("b", -4)],
      500,
    sinHistorico,
    );
    expect(pairs).toHaveLength(1);
    const ids = pairs.flatMap((p) => [p.pointIdA, p.pointIdB]);
    expect(ids).not.toContain("c");
  });

  it("no produce pares si solo un punto tiene lectura", () => {
    expect(
      computeDifferentials([A, B], [lectura("a", -10)], 500, sinHistorico),
    ).toEqual([]);
  });

  // Una lectura cuyo acumulado es null (el punto no tiene C0) tampoco puede
  // compararse: se descarta igual que la ausencia de lectura.
  it("excluye una lectura con acumulado nulo", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -10), lectura("b", null)],
      500,
    sinHistorico,
    );
    expect(pairs).toEqual([]);
  });

  it("calcula el diferencial y la distorsión como 1/X", () => {
    // Diferencial |−1.8 − (−2.5)| = 0.7 mm sobre 6 m ⇒ 6000/0.7 = 1/8571.4
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -1.8), lectura("b", -2.5)],
      500,
    sinHistorico,
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
    sinHistorico,
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
    sinHistorico,
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
    sinHistorico,
    );
    expect(pairs).toHaveLength(0);
  });

  it("excluye el par si a un punto le falta el acumulado", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", null)],
      500,
    sinHistorico,
    );
    expect(pairs).toHaveLength(0);
  });

  it("genera cada par una sola vez, sin repetir el simétrico", () => {
    const C: PointInput = { ...A, id: "c", easting: 12 };
    const pairs = computeDifferentials(
      [A, B, C],
      [lectura("a", -1), lectura("b", -2), lectura("c", -3)],
      500,
    sinHistorico,
    );
    expect(pairs).toHaveLength(3); // a-b, a-c, b-c
  });

  describe("periodo común (Fase 11)", () => {
    // P-07 entra el 15/03. P-01 lleva C0 = 100.000 desde el 15/01 y el 15/03
    // midió 99.991; hoy mide 99.989. P-07 midió 101.2345 al darse de alta y
    // hoy 101.2315. Desde t0 = 15/03:
    //   P-01: (99.989 − 99.991) × 1000 = −2.0 mm
    //   P-07: (101.2315 − 101.2345) × 1000 = −3.0 mm   ⇒ diferencial 1.0 mm
    // Restar acumulados habría dado |−11.0 − (−3.0)| = 8.0 mm: la distorsión
    // de un periodo que P-07 no vivió.
    const p01: ComputedReading = {
      ...lectura("a", -11.0),
      elevation: 99.989,
      baselineDate: "2025-01-15",
      baselineElevation: 100.0,
    };
    const p07: ComputedReading = {
      ...lectura("b", -3.0),
      elevation: 101.2315,
      baselineDate: "2025-03-15",
      baselineElevation: 101.2345,
    };
    const cotas: Record<string, number> = { "a|2025-03-15": 99.991 };
    const cotaEn = (id: string, fecha: string) => cotas[`${id}|${fecha}`];

    it("mide los dos puntos desde la línea base más tardía", () => {
      const pairs = computeDifferentials([A, B], [p01, p07], 500, cotaEn);
      expect(pairs).toHaveLength(1);
      expect(pairs[0]?.differentialMm).toBeCloseTo(1.0, 6);
    });

    // La tabla del panel muestra estos dos números junto al diferencial. Antes
    // mostraba los acumulados (−11.0 y −3.0), que restados no dan 1.0: se vio
    // en pantalla al verificar la fase.
    it("devuelve los dos asentamientos del periodo común, que restados dan el diferencial", () => {
      const [pair] = computeDifferentials([A, B], [p01, p07], 500, cotaEn);
      expect(pair?.settlementAMm).toBeCloseTo(-2.0, 6);
      expect(pair?.settlementBMm).toBeCloseTo(-3.0, 6);
      expect(pair?.sinceDate).toBe("2025-03-15");
    });

    it("es simétrico: el orden del par no cambia el resultado", () => {
      const pairs = computeDifferentials([A, B], [p07, p01], 500, cotaEn);
      expect(pairs[0]?.differentialMm).toBeCloseTo(1.0, 6);
    });

    it("un punto con C0 que no se midió en la visita 0 se mide desde t0, no desde la C0", () => {
      // Es el defecto que encontró la revisión del PRD: «usar su acumulado»
      // habría medido P-02 desde su C0 (visita 0) aunque t0 sea su primera
      // lectura. Aquí P-02 tiene C0 = 100.0 fechada el 15/01, y P-07, alta el
      // 15/03. t0 = 15/03 y P-02 midió 99.996 ese día y 99.994 hoy: −2.0 mm.
      const p02: ComputedReading = {
        ...lectura("a", -6.0),
        elevation: 99.994,
        baselineDate: "2025-01-15",
        baselineElevation: 100.0,
      };
      const pairs = computeDifferentials([A, B], [p02, p07], 500, (id, f) =>
        id === "a" && f === "2025-03-15" ? 99.996 : undefined,
      );
      expect(pairs[0]?.differentialMm).toBeCloseTo(1.0, 6);
    });

    it("excluye el par si un punto no se midió en t0", () => {
      const pairs = computeDifferentials([A, B], [p01, p07], 500, sinHistorico);
      expect(pairs).toEqual([]);
    });
  });

  it("el diferencial es siempre positivo, sea cual sea el orden", () => {
    const pairs = computeDifferentials(
      [A, B],
      [lectura("a", -5), lectura("b", -1)],
      500,
    sinHistorico,
    );
    expect(pairs[0]?.differentialMm).toBeCloseTo(4, 6);
  });
});

const T: Thresholds = thresholdsFor("edificio");
// velocidad 2/5/10 mm/mes · acumulado 25/50/75 mm

describe("classifyAlert", () => {
  it("es normal por debajo de todos los umbrales", () => {
    expect(classifyAlert(-1.9, -24, T)).toBe("normal");
  });

  it("clasifica en la frontera exacta del umbral (>=, no >)", () => {
    expect(classifyAlert(-2, 0, T)).toBe("caution");
    expect(classifyAlert(-5, 0, T)).toBe("alert");
    expect(classifyAlert(-10, 0, T)).toBe("alarm");
    expect(classifyAlert(0, -25, T)).toBe("caution");
    expect(classifyAlert(0, -50, T)).toBe("alert");
    expect(classifyAlert(0, -75, T)).toBe("alarm");
  });

  it("usa el valor absoluto: un levantamiento rápido también alerta", () => {
    expect(classifyAlert(6, 0, T)).toBe("alert");
    expect(classifyAlert(0, 80, T)).toBe("alarm");
  });

  it("gana la peor de las dos clasificaciones", () => {
    // Velocidad normal pero acumulado en alarma.
    expect(classifyAlert(-1, -80, T)).toBe("alarm");
    // Velocidad en alarma pero acumulado normal.
    expect(classifyAlert(-12, -5, T)).toBe("alarm");
  });

  it("trata la velocidad ausente como no clasificable por velocidad", () => {
    // La línea base no tiene velocidad; solo debe pesar el acumulado.
    expect(classifyAlert(null, -30, T)).toBe("caution");
    expect(classifyAlert(null, 0, T)).toBe("normal");
  });

  it("trata el acumulado ausente como no clasificable por acumulado", () => {
    expect(classifyAlert(-6, null, T)).toBe("alert");
  });

  it("es normal si no hay ni velocidad ni acumulado", () => {
    expect(classifyAlert(null, null, T)).toBe("normal");
  });
});

describe("classifyReadings", () => {
  it("asigna el nivel a cada lectura y el peor a la visita", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        // −60 mm en un mes: acumulado en alerta, velocidad en alarma.
        visita(1, "2025-02-15", 99.94),
      ],
    );
    const clasificadas = classifyReadings(visitas, T);
    expect(clasificadas[0]?.readings[0]?.alertStatus).toBe("normal");
    expect(clasificadas[1]?.readings[0]?.alertStatus).toBe("alarm");
    expect(clasificadas[1]?.worstAlert).toBe("alarm");
  });

  it("el peor de la visita es el máximo entre sus puntos", () => {
    const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
    const visitas = computeSettlements(
      [P1, P2],
      [
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
          readings: [
            { pointId: "p1", elevation: 99.999 }, // −1 mm: normal
            { pointId: "p2", elevation: 99.994 }, // −6 mm: alerta por velocidad
          ],
        },
      ],
    );
    const clasificadas = classifyReadings(visitas, T);
    expect(clasificadas[1]?.worstAlert).toBe("alert");
  });
});

describe("computeTrends", () => {
  it("no afirma nada con menos de 3 visitas", () => {
    const visitas = computeSettlements(
      [P1],
      [visita(0, "2025-01-15", 100.0), visita(1, "2025-02-15", 99.994)],
    );
    expect(computeTrends(visitas)).toEqual({});
  });

  it("marca convergente cuando la velocidad decrece en magnitud", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.994), // −6.0 mm
        visita(2, "2025-03-15", 99.992), // −2.0 mm
      ],
    );
    expect(computeTrends(visitas).p1).toBe("converging");
  });

  it("marca acelerando cuando la velocidad crece en magnitud", () => {
    const visitas = computeSettlements(
      [P1],
      [
        visita(0, "2025-01-15", 100.0),
        visita(1, "2025-02-15", 99.998), // −2.0 mm
        visita(2, "2025-03-15", 99.99), // −8.0 mm
      ],
    );
    expect(computeTrends(visitas).p1).toBe("accelerating");
  });
});

describe("computeHistory", () => {
  it("compone visitas clasificadas, diferenciales de la última y tendencias", () => {
    const A2: PointInput = { ...A, initialElevation: 100 };
    const B2: PointInput = { ...B, initialElevation: 100 };
    const visitas: VisitInput[] = [
      {
        id: "v0",
        visitNumber: 0,
        date: "2025-01-15",
        readings: [
          { pointId: "a", elevation: 100.0 },
          { pointId: "b", elevation: 100.0 },
        ],
      },
      {
        id: "v1",
        visitNumber: 1,
        date: "2025-02-15",
        readings: [
          { pointId: "a", elevation: 99.999 },
          { pointId: "b", elevation: 99.998 },
        ],
      },
    ];
    const h = computeHistory([A2, B2], visitas, T);
    expect(h.visits).toHaveLength(2);
    // Los diferenciales se calculan sobre la ÚLTIMA visita.
    expect(h.differentials).toHaveLength(1);
    expect(h.differentials[0]?.differentialMm).toBeCloseTo(1.0, 6);
    expect(h.trends).toEqual({});
  });

  it("calcula los diferenciales de un punto de alta sobre el periodo común", () => {
    // La ruta real: computeHistory arma la búsqueda de cotas por fecha que
    // computeDifferentials necesita. Mismos números que el test aislado.
    const A7: PointInput = { ...B, initialElevation: null, activeFrom: "2025-03-15" };
    const visitas: VisitInput[] = [
      { id: "v0", visitNumber: 0, date: "2025-01-15", readings: [{ pointId: "a", elevation: 100.0 }] },
      {
        id: "v2",
        visitNumber: 2,
        date: "2025-03-15",
        readings: [
          { pointId: "a", elevation: 99.991 },
          { pointId: "b", elevation: 101.2345 },
        ],
      },
      {
        id: "v3",
        visitNumber: 3,
        date: "2025-04-15",
        readings: [
          { pointId: "a", elevation: 99.989 },
          { pointId: "b", elevation: 101.2315 },
        ],
      },
    ];
    const h = computeHistory([A, A7], visitas, T);
    expect(h.differentials).toHaveLength(1);
    expect(h.differentials[0]?.differentialMm).toBeCloseTo(1.0, 6);
  });

  it("devuelve estructuras vacías si no hay visitas", () => {
    const h = computeHistory([A], [], T);
    expect(h.visits).toEqual([]);
    expect(h.differentials).toEqual([]);
    expect(h.trends).toEqual({});
  });
});

// ============================================================================
// Fase 12 — lectura fuera de tendencia
// ============================================================================

const ORDENES: PrecisionOrder[] = [
  "primer_orden",
  "segundo_orden",
  "tercer_orden",
  "ordinario",
];

/**
 * Serie de un punto a partir de sus parciales (mm) y de los días entre
 * visitas, pasada por `computeHistory` —la ruta real— y evaluada con el orden
 * dado en todas sus visitas. Devuelve los avisos como «visita:tipo».
 */
function avisosDeSerie(
  parciales: number[],
  dias: number[],
  orden: PrecisionOrder,
  punto: PointInput = P1,
): string[] {
  let fecha = Date.parse("2025-01-15T00:00:00Z");
  let cota = 100;
  const visitas: VisitInput[] = [visita(0, "2025-01-15", cota)];
  parciales.forEach((p, i) => {
    fecha += dias[i]! * 86_400_000;
    cota += p / 1000;
    visitas.push(visita(i + 1, new Date(fecha).toISOString().slice(0, 10), cota));
  });
  const h = computeHistory([punto], visitas, T);
  const ordenes = new Map(visitas.map((v) => [v.id, orden]));
  const avisos = detectTrendDeviations(h.visits, ordenes);
  return [...avisos.entries()].flatMap(([vid, porPunto]) =>
    [...porPunto.values()].map((a) => `${vid}:${a.kind}`),
  );
}

describe("trendDeviationMargin", () => {
  it("es la tolerancia de cierre K·√0.25 del orden: 1.5 / 3 / 6 / 12 mm", () => {
    expect(ORDENES.map(trendDeviationMargin)).toEqual([1.5, 3, 6, 12]);
  });
});

describe("detectTrendDeviations — regresión contra series reales", () => {
  // Verificadas al redactar el PRD. Si un cambio de la regla las marca, el
  // cambio está mal: son consolidaciones correctas que frenan.
  const series = {
    "P-09 (marco teórico)": {
      parciales: [-5.8, -5.1, -3.9, -2.9, -1.9, -1.1, -0.4],
      dias: [31, 28, 31, 30, 61, 92, 92],
    },
    "P-06 (seed)": { parciales: [-24, -13, -7, -4, -2.5], dias: [31, 28, 31, 30, 31] },
    "P-01 (seed)": { parciales: [-3.5, -2.2, -1.4, -0.9, -0.5], dias: [31, 28, 31, 30, 31] },
  };
  for (const [nombre, { parciales, dias }] of Object.entries(series)) {
    it.each(ORDENES)(`${nombre} no produce avisos en %s`, (orden) => {
      expect(avisosDeSerie(parciales, dias, orden)).toEqual([]);
    });
  }
});

describe("detectTrendDeviations — la regla", () => {
  // Serie base: −3.0 mm en 30 días (≈ −3.04 mm/mes). La tercera lectura es la
  // que se evalúa: la previsión para 30 días más es 3.0 mm.
  it("marca «contraria» una lectura que sube más que el margen en un punto que baja", () => {
    expect(avisosDeSerie([-3, 6.1], [30, 30], "tercer_orden")).toEqual(["v2:contrary"]);
  });

  it("no marca una subida que no supera el margen (el límite es estricto)", () => {
    expect(avisosDeSerie([-3, 5.9], [30, 30], "tercer_orden")).toEqual([]);
  });

  it("marca «excesiva» una bajada mayor que el doble de lo previsto más el margen", () => {
    // Previsto 3.0 mm → límite 2·3.0 + 6 = 12 mm.
    expect(avisosDeSerie([-3, -12.5], [30, 30], "tercer_orden")).toEqual(["v2:excessive"]);
    expect(avisosDeSerie([-3, -11.5], [30, 30], "tercer_orden")).toEqual([]);
  });

  it("nunca avisa por moverse menos de lo previsto: la consolidación frena", () => {
    expect(avisosDeSerie([-3, 0], [30, 30], "primer_orden")).toEqual([]);
  });

  it("es simétrica: en un punto que sube, bajar más que el margen es «contraria»", () => {
    expect(avisosDeSerie([3, -6.1], [30, 30], "tercer_orden")).toEqual(["v2:contrary"]);
  });

  it("la misma lectura avisa en primer orden y no en tercero", () => {
    expect(avisosDeSerie([-3, 2], [30, 30], "primer_orden")).toEqual(["v2:contrary"]);
    expect(avisosDeSerie([-3, 2], [30, 30], "tercer_orden")).toEqual([]);
  });

  it("no evalúa la segunda lectura del punto: no hay velocidad previa", () => {
    expect(avisosDeSerie([50], [30], "primer_orden")).toEqual([]);
  });

  it("no avisa ni da NaN con dos visitas el mismo día", () => {
    expect(avisosDeSerie([-3, 0, 10], [30, 0, 30], "primer_orden")).toEqual([]);
  });

  it("no evalúa una visita sin orden conocido", () => {
    const h = computeHistory(
      [P1],
      [
        visita(0, "2025-01-15", 100),
        visita(1, "2025-02-15", 99.997),
        visita(2, "2025-03-15", 100.02),
      ],
      T,
    );
    expect(detectTrendDeviations(h.visits, new Map()).size).toBe(0);
  });

  it("devuelve el parcial, la velocidad previa, lo previsto y el margen para el mensaje", () => {
    const h = computeHistory(
      [P1],
      [
        visita(0, "2025-01-15", 100),
        visita(1, "2025-02-14", 99.997), // −3 mm en 30 días
        visita(2, "2025-03-16", 100.004), // +7 mm en 30 días
      ],
      T,
    );
    const aviso = detectTrendDeviations(
      h.visits,
      new Map(h.visits.map((v) => [v.visitId, "tercer_orden" as PrecisionOrder])),
    )
      .get("v2")
      ?.get("p1");
    expect(aviso?.kind).toBe("contrary");
    expect(aviso?.partialMm).toBeCloseTo(7, 6);
    expect(aviso?.previousVelocity).toBeCloseTo(-3 / (30 / 30.4375), 6);
    expect(aviso?.expectedMm).toBeCloseTo(3, 6);
    expect(aviso?.marginMm).toBe(6);
  });
});

describe("detectTrendDeviations — huecos, alta y baja (Fase 11)", () => {
  const P2: PointInput = { ...P1, id: "p2", code: "P-02" };
  const conLecturas = (
    id: string,
    n: number,
    date: string,
    lecturas: [string, number][],
  ): VisitInput => ({
    id,
    visitNumber: n,
    date,
    readings: lecturas.map(([pointId, elevation]) => ({ pointId, elevation })),
  });
  const tercero = (vs: VisitInput[]) =>
    new Map(vs.map((v) => [v.id, "tercer_orden" as PrecisionOrder]));

  it("con un hueco, compara contra la última lectura real y el intervalo real", () => {
    // P1 se mide el 15/01, 15/02 (−3 mm) y, saltándose el 15/03, el 15/04.
    // En 59 días lo previsto es ≈ 5.8 mm: bajar 8 mm está dentro de la banda
    // (2·5.8 + 6), aunque contra un solo mes habría parecido excesivo.
    const vs = [
      conLecturas("v0", 0, "2025-01-15", [["p1", 100], ["p2", 100]]),
      conLecturas("v1", 1, "2025-02-15", [["p1", 99.997], ["p2", 99.997]]),
      conLecturas("v2", 2, "2025-03-15", [["p2", 99.994]]),
      conLecturas("v3", 3, "2025-04-15", [["p1", 99.989], ["p2", 99.991]]),
    ];
    const h = computeHistory([P1, P2], vs, T);
    expect(detectTrendDeviations(h.visits, tercero(vs)).size).toBe(0);
  });

  it("un punto de alta sin C0 se evalúa desde su tercera lectura propia", () => {
    const P7: PointInput = { ...P1, id: "p7", code: "P-07", initialElevation: null, activeFrom: "2025-03-15" };
    const vs = [
      conLecturas("v0", 0, "2025-01-15", [["p1", 100]]),
      conLecturas("v1", 1, "2025-02-15", [["p1", 99.997]]),
      conLecturas("v2", 2, "2025-03-15", [["p1", 99.994], ["p7", 101]]),
      conLecturas("v3", 3, "2025-04-15", [["p1", 99.991], ["p7", 101.02]]), // 2ª: +20 mm, sin evaluar
      conLecturas("v4", 4, "2025-05-15", [["p1", 99.988], ["p7", 101.012]]), // 3ª: evaluada
    ];
    const h = computeHistory([P1, P7], vs, T);
    const avisos = detectTrendDeviations(h.visits, tercero(vs));
    expect(avisos.get("v3")?.has("p7")).toBeFalsy();
    // Venía subiendo ≈ 20 mm/mes y baja 8 mm: contra su tendencia, más que 6.
    expect(avisos.get("v4")?.get("p7")?.kind).toBe("contrary");
  });
});
