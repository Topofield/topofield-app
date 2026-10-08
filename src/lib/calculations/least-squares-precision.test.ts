// Fase 39: la precisión de cada punto ajustado por mínimos cuadrados —σ N,
// σ E y la elipse de error al 95 %— (Ghilani y Wolf, Adjustment Computations,
// 4.ª ed., cap. 19).
import { describe, expect, it } from "vitest";
import { adjustedCofactor, ellipseScale, errorEllipse, fQuantile2 } from "./least-squares";
import { computePolygonal } from "./polygonal";
import { azimuthFromCoordinates, dmsToDecimal } from "./angles";
import { CARTERA_VIVERO } from "@/lib/demo/carteras";
import type { LeastSquaresWeights, PolygonalInput, PolygonalResult, StationInput } from "@/types/polygonal";

describe("F(α, 2, r) y el factor de la elipse (Ghilani, tabla 19.2 y ec. 19.22)", () => {
  // Tabla 19.2: F con 2 grados de libertad en el numerador.
  const tabla: [number, number, number, number][] = [
    // r, 90 %, 95 %, 99 %
    [1, 49.5, 199.5, 4999.5],
    [2, 9.0, 19.0, 99.0],
    [3, 5.46, 9.55, 30.82],
    [4, 4.32, 6.94, 18.0],
    [5, 3.78, 5.79, 13.27],
    [10, 2.92, 4.1, 7.56],
  ];

  it.each(tabla)("con r = %i reproduce la tabla al 90, 95 y 99 %%", (r, f90, f95, f99) => {
    expect(fQuantile2(0.1, r)).toBeCloseTo(f90, 2);
    expect(fQuantile2(0.05, r)).toBeCloseTo(f95, 2);
    expect(fQuantile2(0.01, r)).toBeCloseTo(f99, 1);
  });

  it("c = √(2F): 4.37 con r = 3 y 6.16 con r = 2, al 95 %", () => {
    expect(ellipseScale(3)).toBeCloseTo(Math.sqrt(2 * 9.5519), 3);
    expect(ellipseScale(3)).toBeCloseTo(4.371, 3);
    expect(ellipseScale(2)).toBeCloseTo(Math.sqrt(38), 6);
  });

  it("el ejemplo 19.1 de Ghilani: con r = 1, una elipse estándar de 0.25 pasa a 4.99 al 95 %", () => {
    expect(0.25 * ellipseScale(1)).toBeCloseTo(4.99, 2);
  });
});

describe("errorEllipse: semiejes y orientación de una covarianza N–E", () => {
  it("sin correlación, el semieje mayor va por el Norte si σ N es mayor", () => {
    const e = errorEllipse({ nn: 4, ee: 1, ne: 0 });
    expect(e.semiMajor).toBeCloseTo(2, 12);
    expect(e.semiMinor).toBeCloseTo(1, 12);
    expect(e.majorAzimuth).toBeCloseTo(0, 12);
  });

  it("y por el Este si σ E es mayor", () => {
    const e = errorEllipse({ nn: 1, ee: 4, ne: 0 });
    expect(e.majorAzimuth).toBeCloseTo(90, 12);
  });

  it("recupera una elipse girada: semiejes 3 y 1, el mayor al azimut 30°", () => {
    // Σ = R·diag(a², b²)·Rᵀ, con el eje mayor en la dirección (N, E) = (cos 30°, sen 30°).
    const t = (30 * Math.PI) / 180;
    const [a2, b2] = [9, 1];
    const cov = {
      nn: a2 * Math.cos(t) ** 2 + b2 * Math.sin(t) ** 2,
      ee: a2 * Math.sin(t) ** 2 + b2 * Math.cos(t) ** 2,
      ne: (a2 - b2) * Math.sin(t) * Math.cos(t),
    };
    const e = errorEllipse(cov);
    expect(e.semiMajor).toBeCloseTo(3, 12);
    expect(e.semiMinor).toBeCloseTo(1, 12);
    expect(e.majorAzimuth).toBeCloseTo(30, 10);
  });

  it("el azimut del eje mayor queda en [0°, 180°): una elipse no tiene sentido", () => {
    const e = errorEllipse({ nn: 2, ee: 2, ne: -1 });
    expect(e.majorAzimuth).toBeCloseTo(135, 10);
  });

  it("un punto fijo, sin varianza, da una elipse nula", () => {
    expect(errorEllipse({ nn: 0, ee: 0, ne: 0 })).toEqual({ semiMajor: 0, semiMinor: 0, majorAzimuth: 0 });
  });
});

describe("adjustedCofactor: Q_l̂ = Q − Q·Aᵀ·N⁻¹·A·Q", () => {
  // Tres ángulos de un triángulo con una sola condición, Σ = 180°.
  const A = [[1, 1, 1]];
  const q = [1, 4, 9];
  const N = [[q.reduce((s, x) => s + x, 0)]];
  const Q = adjustedCofactor({ A, q, N });

  it("las observaciones ajustadas cumplen la condición sin varianza: A·Q_l̂·Aᵀ = 0", () => {
    const s = [0, 1, 2].reduce((acc, i) => acc + [0, 1, 2].reduce((a2, j) => a2 + Q[i]![j]!, 0), 0);
    expect(s).toBeCloseTo(0, 12);
  });

  it("es simétrica y no supera a Q en la diagonal", () => {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) expect(Q[i]![j]!).toBeCloseTo(Q[j]![i]!, 12);
      expect(Q[i]![i]!).toBeLessThanOrEqual(q[i]!);
    }
  });

  it("coincide con la fórmula a mano: q₁ − q₁²/Σq", () => {
    expect(Q[0]![0]!).toBeCloseTo(1 - 1 / 14, 12);
    expect(Q[0]![1]!).toBeCloseTo(-(1 * 4) / 14, 12);
  });
});

// --- La precisión de cada punto, contra cálculos independientes -----------------

// Pesos de la hoja de la universidad: 2″, 0.011 m, 2 mediciones.
const HOJA: LeastSquaresWeights = { sigmaAngleSeconds: 2, sigmaDistanceM: 0.011, distanceMeasurements: 2 };
const RHO = 206264.80624709636;
const SIGMA_ANGLE = HOJA.sigmaAngleSeconds / RHO;
const SIGMA_DIST = HOJA.sigmaDistanceM / Math.sqrt(HOJA.distanceMeasurements);

function st(pointCode: string, angle: number, distance: number | null, dir: "right" | "left" | null = null): StationInput {
  return { pointCode, angle, deflectionDirection: dir, distance, readings: [{ order: 1, angle }] };
}

function precisionOf(r: PolygonalResult) {
  if (r.adjustment?.status !== "adjusted") throw new Error("sin ajuste");
  return r.adjustment.precision;
}

const vivero: PolygonalInput = {
  type: "closed",
  method: "least_squares",
  order: "tercer_orden",
  angleType: CARTERA_VIVERO.angleType,
  hasOrientation: true,
  hasClosingRow: false,
  startNorth: CARTERA_VIVERO.startNorth,
  startEast: CARTERA_VIVERO.startEast,
  startAzimuth: azimuthFromCoordinates(
    CARTERA_VIVERO.startNorth,
    CARTERA_VIVERO.startEast,
    CARTERA_VIVERO.referenceNorth,
    CARTERA_VIVERO.referenceEast,
  ),
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  leastSquares: HOJA,
  stations: CARTERA_VIVERO.stations.map((s) => st(s.pointCode, dmsToDecimal(...s.readings[0]!), s.distance)),
};

// Un ajuste paramétrico escrito aquí, sin nada del motor: las incógnitas son
// las coordenadas de los vértices; el datum, la partida y el azimut del primer
// lado, igual que en el motor (P₁ se mueve solo a lo largo de ese azimut).
type Pt = { n: number; e: number };
const az = (a: Pt, b: Pt) => Math.atan2(b.e - a.e, b.n - a.n);
const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

function invert(M: number[][]): number[][] {
  const n = M.length;
  const a = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[p]![c]!)) p = r;
    [a[c], a[p]] = [a[p]!, a[c]!];
    const piv = a[c]![c]!;
    for (let x = 0; x < 2 * n; x++) a[c]![x]! /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = a[r]![c]!;
      for (let x = 0; x < 2 * n; x++) a[r]![x]! -= k * a[c]![x]!;
    }
  }
  return a.map((row) => row.slice(n));
}

interface Observation {
  /** El modelo: el valor que darían unos puntos. */
  model: (p: Pt[]) => number;
  value: number;
  sigma: number;
  angle: boolean;
}

/** Covarianza de P₁..Pₘ (en coordenadas locales a P₀) por el ajuste paramétrico. */
function parametric(az0: number, init: Pt[], obs: Observation[]) {
  const m = init.length - 1;
  const points = (x: number[]): Pt[] => [
    { n: 0, e: 0 },
    { n: x[0]! * Math.cos(az0), e: x[0]! * Math.sin(az0) },
    ...Array.from({ length: m - 1 }, (_, i) => ({ n: x[1 + 2 * i]!, e: x[2 + 2 * i]! })),
  ];
  let x = [Math.hypot(init[1]!.n, init[1]!.e), ...init.slice(2).flatMap((p) => [p.n, p.e])];
  const h = 1e-6;
  const jac = (f: (x: number[]) => number[], at: number[]) =>
    at.map((_, j) => {
      const up = [...at];
      const dn = [...at];
      up[j]! += h;
      dn[j]! -= h;
      const fu = f(up);
      const fd = f(dn);
      return fu.map((v, i) => (v - fd[i]!) / (2 * h));
    });
  const model = (x: number[]) => obs.map((o) => o.model(points(x)));
  let A: number[][] = [];
  let v: number[] = [];
  for (let it = 0; it < 10; it++) {
    const cols = jac(model, x); // cols[j][i] = ∂fᵢ/∂xⱼ
    A = obs.map((_, i) => cols.map((c) => c[i]!));
    const f = model(x);
    const L = obs.map((o, i) => (o.angle ? wrap(o.value - f[i]!) : o.value - f[i]!));
    const P = obs.map((o) => 1 / (o.sigma * o.sigma));
    const N = x.map((_, a) => x.map((_, b) => A.reduce((s, row, i) => s + row[a]! * P[i]! * row[b]!, 0)));
    const u = x.map((_, a) => A.reduce((s, row, i) => s + row[a]! * P[i]! * L[i]!, 0));
    const Ninv = invert(N);
    const dx = x.map((_, a) => Ninv[a]!.reduce((s, nab, b) => s + nab * u[b]!, 0));
    x = x.map((xi, a) => xi + dx[a]!);
    v = L;
  }
  const f = model(x);
  v = obs.map((o, i) => (o.angle ? wrap(o.value - f[i]!) : o.value - f[i]!));
  const vPv = obs.reduce((s, o, i) => s + (v[i]! / o.sigma) ** 2, 0);
  const sigma0 = Math.sqrt(vPv / (obs.length - x.length));
  const P = obs.map((o) => 1 / (o.sigma * o.sigma));
  const N = x.map((_, a) => x.map((_, b) => A.reduce((s, row, i) => s + row[a]! * P[i]! * row[b]!, 0)));
  const Sx = invert(N).map((row) => row.map((q) => q * sigma0 * sigma0));
  // Covarianza de cada punto: G·Σx·Gᵀ, con G = ∂(N, E)/∂x.
  const G = jac((x) => points(x).flatMap((p) => [p.n, p.e]), x);
  const cov = Array.from({ length: m + 1 }, (_, k) => {
    const gn = G.map((c) => c[2 * k]!);
    const ge = G.map((c) => c[2 * k + 1]!);
    const quad = (a: number[], b: number[]) =>
      a.reduce((s, ai, i) => s + ai * b.reduce((t, bj, j) => t + Sx[i]![j]! * bj, 0), 0);
    return { nn: quad(gn, gn), ee: quad(ge, ge), ne: quad(gn, ge) };
  });
  return { cov, sigma0 };
}

describe("precisión de cada punto — cerrada Vivero contra un ajuste paramétrico", () => {
  const r = computePolygonal(vivero);
  const pr = precisionOf(r);
  const st0 = r.stations;
  // Los vértices P₀..P₄ en coordenadas locales, de lo ajustado por el motor.
  const local = st0.slice(0, 5).map((s) => ({ n: s.north! - vivero.startNorth, e: s.east! - vivero.startEast }));
  const az0 = (r.stations[0]!.azimuth! * Math.PI) / 180;
  const ang = (i: number) => (vivero.stations[i]!.angle * Math.PI) / 180;
  const next = (i: number) => (i + 1) % 5;
  const prev = (i: number) => (i + 4) % 5;
  const obs: Observation[] = [
    // Ángulos en D1..D4 y el de cierre en Famarena_5, contra el primer lado.
    ...[1, 2, 3, 4].map((i) => ({
      model: (p: Pt[]) => az(p[i]!, p[next(i)]!) - az(p[i]!, p[prev(i)]!),
      value: ang(i),
      sigma: SIGMA_ANGLE,
      angle: true,
    })),
    {
      model: (p: Pt[]) => az(p[0]!, p[1]!) - az(p[0]!, p[4]!),
      value: ang(5),
      sigma: SIGMA_ANGLE,
      angle: true,
    },
    ...[0, 1, 2, 3, 4].map((k) => ({
      model: (p: Pt[]) => Math.hypot(p[next(k)]!.n - p[k]!.n, p[next(k)]!.e - p[k]!.e),
      value: vivero.stations[k]!.distance!,
      sigma: SIGMA_DIST,
      angle: false,
    })),
  ];
  const ref = parametric(az0, local, obs);

  it("los dos ajustes dan el mismo σ₀", () => {
    if (r.adjustment?.status !== "adjusted") throw new Error("sin ajuste");
    expect(r.adjustment.sigma0).toBeCloseTo(ref.sigma0, 8);
  });

  it("σ N, σ E y la covarianza de D1..D4 coinciden a la millonésima de milímetro", () => {
    for (let i = 1; i <= 4; i++) {
      const p = pr.stations[i]!;
      expect(p.sigmaNorth * 1000).toBeCloseTo(Math.sqrt(ref.cov[i]!.nn) * 1000, 6);
      expect(p.sigmaEast * 1000).toBeCloseTo(Math.sqrt(ref.cov[i]!.ee) * 1000, 6);
      expect(p.covarianceNE * 1e6).toBeCloseTo(ref.cov[i]!.ne * 1e6, 6);
    }
  });

  it("la partida y la vuelta a ella son fijas: no tienen precisión", () => {
    expect(pr.stations[0]).toBeNull();
    expect(pr.stations[5]).toBeNull();
  });

  it("la elipse al 95 % es la estándar por c = 4.37 (r = 3)", () => {
    expect(pr.confidence).toBe(0.95);
    expect(pr.scale).toBeCloseTo(ellipseScale(3), 12);
    for (let i = 1; i <= 4; i++) {
      const p = pr.stations[i]!;
      const std = errorEllipse({ nn: p.sigmaNorth ** 2, ee: p.sigmaEast ** 2, ne: p.covarianceNE });
      expect(p.ellipse.semiMajor).toBeCloseTo(std.semiMajor * pr.scale, 12);
      expect(p.ellipse.semiMinor).toBeCloseTo(std.semiMinor * pr.scale, 12);
      expect(p.ellipse.majorAzimuth).toBeCloseTo(std.majorAzimuth, 9);
    }
  });

  it("modelada sin amarre —el mismo dato, otro camino del motor— da la misma precisión", () => {
    const sinAmarre = computePolygonal({
      ...vivero,
      hasOrientation: false,
      startAzimuth: r.stations[0]!.azimuth!,
      // El ángulo de cierre en Famarena_5 pasa a la estación 0; ya no hay vuelta.
      stations: [
        st("Famarena_5", vivero.stations[5]!.angle, vivero.stations[0]!.distance),
        ...vivero.stations.slice(1, 5),
      ],
    });
    const p2 = precisionOf(sinAmarre);
    expect(p2.stations[0]).toBeNull();
    for (let i = 1; i <= 4; i++) {
      expect(p2.stations[i]!.sigmaNorth).toBeCloseTo(pr.stations[i]!.sigmaNorth, 12);
      expect(p2.stations[i]!.sigmaEast).toBeCloseTo(pr.stations[i]!.sigmaEast, 12);
    }
  });
});

describe("precisión de cada punto — abierta con control, contra la propagación por diferencias finitas", () => {
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
    endNorth: -0.01,
    endEast: 100.02,
    endAzimuth: 180,
    leastSquares: HOJA,
    stations: [
      st("P1", 0, 100),
      st("P2", 90.002, 100, "right"),
      st("P3", 89.998, 100.01, "right"),
      st("P4", 0.0015, 0, "right"),
    ],
  };

  // Σ a priori de las coordenadas ajustadas, propagando por todo el ajuste:
  // J = ∂(coordenadas ajustadas)/∂(observaciones de campo), Σ = J·Q·Jᵀ.
  function propagated(input: PolygonalInput, angleStations: number[], sides: number) {
    const coords = (inp: PolygonalInput) => computePolygonal(inp).stations.flatMap((s) => [s.north!, s.east!]);
    const vary: { apply: (inp: PolygonalInput, d: number) => PolygonalInput; sigma: number; h: number }[] = [
      ...angleStations.map((i) => ({
        apply: (inp: PolygonalInput, d: number) => ({
          ...inp,
          stations: inp.stations.map((s, j) => (j === i ? { ...s, angle: s.angle + d } : s)),
        }),
        sigma: HOJA.sigmaAngleSeconds / 3600,
        h: 1e-6,
      })),
      ...Array.from({ length: sides }, (_, k) => ({
        apply: (inp: PolygonalInput, d: number) => ({
          ...inp,
          stations: inp.stations.map((s, j) => (j === k ? { ...s, distance: s.distance! + d } : s)),
        }),
        sigma: SIGMA_DIST,
        h: 1e-6,
      })),
    ];
    const J = vary.map((o) => {
      const up = coords(o.apply(input, o.h));
      const dn = coords(o.apply(input, -o.h));
      return up.map((u, x) => (u - dn[x]!) / (2 * o.h));
    });
    return (station: number) => {
      const [n, e] = [2 * station, 2 * station + 1];
      const q = (a: number, b: number) => vary.reduce((s, o, j) => s + J[j]![a]! * o.sigma ** 2 * J[j]![b]!, 0);
      return { nn: q(n, n), ee: q(e, e), ne: q(n, e) };
    };
  }

  it.each([
    ["con azimut de llegada (r = 3)", 180, 3, [1, 2, 3]],
    ["sin azimut de llegada (r = 2)", null, 2, [1, 2]],
  ] as const)("%s", (_, endAzimuth, r, angleStations) => {
    const input = { ...base, endAzimuth };
    const res = computePolygonal(input);
    if (res.adjustment?.status !== "adjusted") throw new Error("sin ajuste");
    expect(res.adjustment.conditions).toBe(r);
    const pr = res.adjustment.precision;
    expect(pr.scale).toBeCloseTo(ellipseScale(r), 12);
    const s0 = res.adjustment.sigma0;
    const prop = propagated(input, [...angleStations], 3);
    for (const i of [1, 2]) {
      const ref = prop(i);
      const p = pr.stations[i]!;
      // La precisión del motor lleva σ₀²; la propagación, el σ₀ = 1 a priori.
      expect((p.sigmaNorth / s0) * 1000).toBeCloseTo(Math.sqrt(ref.nn) * 1000, 4);
      expect((p.sigmaEast / s0) * 1000).toBeCloseTo(Math.sqrt(ref.ee) * 1000, 4);
      expect((p.covarianceNE / s0 ** 2) * 1e6).toBeCloseTo(ref.ne * 1e6, 3);
    }
    // La partida es fija, y la llegada es un punto conocido.
    expect(pr.stations[0]).toBeNull();
    expect(pr.stations[3]).toBeNull();
  });
});
