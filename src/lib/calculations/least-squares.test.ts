import { describe, expect, it } from "vitest";
import {
  adjustByConditions,
  SIGMA0_BAND,
  sigma0Reading,
  solveLinear,
} from "./least-squares";
import { computePolygonal } from "./polygonal";
import { azimuthFromCoordinates, dmsToDecimal } from "./angles";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import type {
  LeastSquaresWeights,
  PolygonalInput,
  PolygonalResult,
  StationInput,
} from "@/types/polygonal";

// Pesos de la hoja de la universidad (Ajuste_Poligonal_Minimos_Cuadrados.xlsx,
// celdas C37, F36 y F37): 2″, 0.011 m, 2 mediciones.
const HOJA: LeastSquaresWeights = {
  sigmaAngleSeconds: 2,
  sigmaDistanceM: 0.011,
  distanceMeasurements: 2,
};

function fromCartera(c: Cartera, method: PolygonalInput["method"]): PolygonalInput {
  return {
    type: "closed",
    method,
    order: "tercer_orden",
    angleType: c.angleType,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    leastSquares: HOJA,
    stations: c.stations.map((s) => ({
      pointCode: s.pointCode,
      angle: dmsToDecimal(...s.readings[0]!),
      deflectionDirection: null,
      distance: s.distance,
      readings: s.readings.map((r, i) => ({ order: i + 1, angle: dmsToDecimal(...r) })),
    })),
  };
}

function st(pointCode: string, angle: number, distance: number | null, dir: "right" | "left" | null = null): StationInput {
  return { pointCode, angle, deflectionDirection: dir, distance, readings: [{ order: 1, angle }] };
}

/** Cierre de las coordenadas ajustadas: la suma de las proyecciones corregidas. */
function closure(r: PolygonalResult) {
  const n = r.stations.reduce((a, s) => a + (s.correctedDeltaNorth ?? 0), 0);
  const e = r.stations.reduce((a, s) => a + (s.correctedDeltaEast ?? 0), 0);
  return { n, e };
}

function adjusted(r: PolygonalResult) {
  if (r.adjustment?.status !== "adjusted") throw new Error("sin ajuste");
  return r.adjustment;
}

describe("solveLinear", () => {
  it("resuelve un sistema 3×3", () => {
    const x = solveLinear([[2, 1, -1], [-3, -1, 2], [-2, 1, 2]], [8, -11, -3]);
    expect(x.map((v) => Math.round(v * 1e9) / 1e9)).toEqual([2, 3, -1]);
  });
});

describe("mínimos cuadrados — cartera Vivero con los pesos de la hoja", () => {
  const input = fromCartera(CARTERA_VIVERO, "least_squares");
  const r = computePolygonal(input);
  const a = adjusted(r);

  // Valores del cálculo independiente del PRD (docs/prds/13-minimos-cuadrados.md,
  // «Pruebas»). NO los del análisis de la cartera: ese partió de azimuts con
  // el defecto de conversión de la hoja (hallazgo 2).
  it("reproduce las correcciones angulares", () => {
    // Estación 0 es la orientación: datum, no se ajusta.
    expect(a.angleCorrectionsSec[0]).toBeNull();
    const esperadas = [0.757, 0.771, 0.876, 0.855, 0.741];
    esperadas.forEach((c, i) => expect(a.angleCorrectionsSec[i + 1]).toBeCloseTo(c, 3));
  });

  it("reproduce las correcciones de las distancias", () => {
    const esperadas = [-3.93, -2.94, 1.86, 3.36, -0.92];
    esperadas.forEach((mm, k) => expect((a.distanceCorrectionsM[k] ?? 0) * 1000).toBeCloseTo(mm, 2));
    // La última fila repite el primer lado como chequeo: no es lado.
    expect(a.distanceCorrectionsM[5]).toBeNull();
  });

  it("reproduce las coordenadas ajustadas", () => {
    const esperadas: [number, number][] = [
      [100117.4637, 101515.6314],
      [100113.1749, 101528.7028],
      [100182.2402, 101581.7806],
      [100193.8992, 101558.7099],
    ];
    esperadas.forEach(([n, e], i) => {
      expect(r.stations[i + 1]!.north!).toBeCloseTo(n, 4);
      expect(r.stations[i + 1]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("σ₀ = 0.698", () => {
    expect(a.sigma0).toBeCloseTo(0.698, 3);
  });

  it("deja las tres condiciones en cero", () => {
    const { n, e } = closure(r);
    expect(Math.abs(n)).toBeLessThan(1e-9);
    expect(Math.abs(e)).toBeLessThan(1e-9);
    const suma = r.stations.slice(1).reduce((acc, s) => acc + (s.correctedAngle ?? 0), 0);
    expect(Math.abs((suma - 540) * 3600)).toBeLessThan(1e-6);
    expect(a.conditions).toBe(3);
  });

  it("las correcciones angulares NO son iguales: si lo fueran, sería el reparto proporcional", () => {
    const c = a.angleCorrectionsSec.slice(1) as number[];
    expect(Math.max(...c) - Math.min(...c)).toBeGreaterThan(0.1);
  });

  it("no cambia el veredicto: mismo error angular, lineal y precisión que Bowditch", () => {
    const b = computePolygonal(fromCartera(CARTERA_VIVERO, "bowditch"));
    expect(r.angularError).toBeCloseTo(b.angularError!, 9);
    expect(r.linearError).toBeCloseTo(b.linearError!, 9);
    expect(r.relativePrecision).toBeCloseTo(b.relativePrecision!, 6);
    expect(r.meetsTolerance).toBe(b.meetsTolerance);
  });

  it("converge en pocas iteraciones", () => {
    expect(a.iterations).toBeLessThanOrEqual(4);
  });
});

describe("mínimos cuadrados — cartera TT4 (fila de cierre contra el amarre)", () => {
  const input = fromCartera(CARTERA_TT4, "least_squares");
  const r = computePolygonal(input);
  const a = adjusted(r);

  it("deja las condiciones lineales en cero y vuelve al arranque", () => {
    const { n, e } = closure(r);
    expect(Math.abs(n)).toBeLessThan(1e-9);
    expect(Math.abs(e)).toBeLessThan(1e-9);
  });

  it("no ajusta la orientación: es datum", () => {
    expect(a.angleCorrectionsSec[0]).toBeNull();
    expect(r.stations[0]!.correctedAngle).toBeCloseTo(input.stations[0]!.angle, 12);
  });

  it("cumple la condición angular con la orientación como constante", () => {
    const suma = r.stations.reduce((acc, s) => acc + (s.correctedAngle ?? 0), 0);
    expect(Math.abs((suma - r.theoreticalSum!) * 3600)).toBeLessThan(1e-6);
  });
});

describe("mínimos cuadrados — abierta con control", () => {
  const base: PolygonalInput = {
    type: "open_controlled",
    method: "least_squares",
    order: "tercer_orden",
    angleType: "deflection",
    hasOrientation: false,
    hasClosingRow: false,
    startNorth: 0,
    startEast: 0,
    startAzimuth: 0,
    endNorth: 100.03,
    endEast: 99.98,
    endAzimuth: 180,
    leastSquares: HOJA,
    stations: [st("P1", 0, 100), st("P2", 90.002, 100, "right"), st("P3", 89.999, 0, "right")],
  };

  it("con azimut de llegada: tres condiciones y llega al punto conocido", () => {
    const r = computePolygonal(base);
    const a = adjusted(r);
    expect(a.conditions).toBe(3);
    const last = r.stations.at(-1)!;
    expect(last.north).toBeCloseTo(100.03, 9);
    expect(last.east).toBeCloseTo(99.98, 9);
  });

  it("sin azimut de llegada: dos condiciones y también llega", () => {
    const r = computePolygonal({ ...base, endAzimuth: null });
    const a = adjusted(r);
    expect(a.conditions).toBe(2);
    expect(r.stations.at(-1)!.north).toBeCloseTo(100.03, 9);
    expect(r.stations.at(-1)!.east).toBeCloseTo(99.98, 9);
  });
});

describe("mínimos cuadrados — pesos", () => {
  it("sin pesos no hay ajuste ni coordenadas, y lo dice", () => {
    const r = computePolygonal({ ...fromCartera(CARTERA_VIVERO, "least_squares"), leastSquares: null });
    expect(r.adjustment).toEqual({ status: "missing_weights" });
    expect(r.stations[1]!.north).toBeNull();
    // El veredicto sigue: se juzga antes de ajustar.
    expect(r.linearError).not.toBeNull();
  });

  it("escalar todos los σ ×2 divide σ₀ entre 2 y deja las correcciones iguales", () => {
    const uno = adjusted(computePolygonal(fromCartera(CARTERA_VIVERO, "least_squares")));
    const dos = adjusted(
      computePolygonal({
        ...fromCartera(CARTERA_VIVERO, "least_squares"),
        leastSquares: { ...HOJA, sigmaAngleSeconds: 4, sigmaDistanceM: 0.022 },
      }),
    );
    expect(dos.sigma0).toBeCloseTo(uno.sigma0 / 2, 9);
    uno.angleCorrectionsSec.forEach((c, i) =>
      c === null ? expect(dos.angleCorrectionsSec[i]).toBeNull() : expect(dos.angleCorrectionsSec[i]).toBeCloseTo(c, 9),
    );
  });

  it("un σ angular mayor carga más corrección en los ángulos", () => {
    const base = adjusted(computePolygonal(fromCartera(CARTERA_VIVERO, "least_squares")));
    const flojo = adjusted(
      computePolygonal({ ...fromCartera(CARTERA_VIVERO, "least_squares"), leastSquares: { ...HOJA, sigmaAngleSeconds: 20 } }),
    );
    const total = (a: typeof base) => a.angleCorrectionsSec.reduce<number>((s, c) => s + Math.abs(c ?? 0), 0);
    expect(total(flojo)).toBeGreaterThan(total(base));
  });
});

describe("adjustByConditions — coeficientes analíticos contra diferencias finitas", () => {
  // Se reconstruye el modelo de la cerrada con A numérico y se compara el
  // resultado: si los coeficientes analíticos del motor estuvieran mal, las
  // correcciones diferirían.
  it("la cerrada Vivero da lo mismo con A por diferencias finitas", () => {
    const input = fromCartera(CARTERA_VIVERO, "least_squares");
    const analitico = adjusted(computePolygonal(input));
    const ang = input.stations.map((s) => s.angle);
    const dist = input.stations.slice(0, 5).map((s) => s.distance!);
    const d2r = Math.PI / 180;
    const f = (l: number[]) => {
      const a = [...ang];
      for (let j = 0; j < 5; j++) a[j + 1] = l[j]! / d2r;
      const az = [((input.startAzimuth + a[0]!) % 360 + 360) % 360];
      for (let i = 1; i < a.length; i++) az.push(az[i - 1]! + 180 + a[i]!);
      const d = l.slice(5);
      return [
        (a.slice(1).reduce((x, y) => x + y, 0) - 540) * d2r,
        d.reduce((s, dk, k) => s + dk * Math.cos(az[k]! * d2r), 0),
        d.reduce((s, dk, k) => s + dk * Math.sin(az[k]! * d2r), 0),
      ];
    };
    const numerico = adjustByConditions({
      observations: [...ang.slice(1).map((x) => x * d2r), ...dist],
      sigmas: [...ang.slice(1).map(() => 2 / 206264.80624709636), ...dist.map(() => 0.011 / Math.SQRT2)],
      evaluate: (l) => {
        const f0 = f(l);
        const h = 1e-7;
        const A = f0.map(() => l.map(() => 0));
        l.forEach((_, i) => {
          const up = [...l];
          const dn = [...l];
          up[i] = up[i]! + h;
          dn[i] = dn[i]! - h;
          const fu = f(up);
          const fd = f(dn);
          f0.forEach((__, k) => (A[k]![i] = (fu[k]! - fd[k]!) / (2 * h)));
        });
        return { f: f0, A };
      },
    });
    for (let j = 0; j < 5; j++) {
      expect(numerico.corrections[j]! * 206264.80624709636).toBeCloseTo(analitico.angleCorrectionsSec[j + 1]!, 4);
    }
    expect(numerico.sigma0).toBeCloseTo(analitico.sigma0, 6);
  });
});

describe("sigma0Reading", () => {
  it("lee σ₀ dentro, por encima y por debajo de la banda", () => {
    expect(sigma0Reading(0.698)).toBe("consistent");
    expect(sigma0Reading(SIGMA0_BAND[0])).toBe("consistent");
    expect(sigma0Reading(SIGMA0_BAND[1])).toBe("consistent");
    expect(sigma0Reading(3.1)).toBe("worse");
    expect(sigma0Reading(0.2)).toBe("pessimistic");
  });
});
