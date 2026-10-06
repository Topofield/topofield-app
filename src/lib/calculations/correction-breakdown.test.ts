// Fase 35: lo que el informe y el ajuste muestran de cada método sale del
// motor. Valores de la cartera TT4, verificados contra la hoja de la Brújula.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates } from "./angles";
import { computePolygonalDetected } from "./polygonal";
import { correctionBreakdown } from "./correction-breakdown";
import type { CorrectionMethod, PolygonalInput } from "@/types/polygonal";

function run(method: CorrectionMethod) {
  const c = CARTERA_TT4;
  const base: Omit<PolygonalInput, "order" | "angleType"> = {
    type: "closed",
    method,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    hasOrientation: true,
    hasClosingRow: true,
    leastSquares: { sigmaAngleSeconds: 5, sigmaDistanceM: 0.005, distanceMeasurements: 1 },
    stations: c.stations.map((s) => {
      const [d, m, x] = s.readings[0]!;
      return {
        pointCode: s.pointCode,
        angle: d + m / 60 + x / 3600,
        deflectionDirection: null,
        distance: s.distance,
        readings: [],
      };
    }),
  };
  const { result, order, angleType } = computePolygonalDetected(base);
  return correctionBreakdown({ ...base, order: order ?? "ordinario", angleType }, result)!;
}

describe("correctionBreakdown con la TT4", () => {
  it("Brújula: −1.71″ por ángulo, factor e/P y la corrección de cada lado", () => {
    const b = run("bowditch");
    if (b.method !== "bowditch") throw new Error(b.method);
    expect(b.angular.perAngleSec).toBeCloseTo(-1.714, 3);
    expect(b.angular.count).toBe(7);
    expect(b.angular.includesOrientation).toBe(true);
    expect(b.perimeter).toBeCloseTo(115.712, 3);
    // Con e_N sin redondear (0.008417 m), no con el 0.0084 de la hoja.
    expect(b.factorN).toBeCloseTo(-7.274e-5, 7);
    expect(b.factorE).toBeCloseTo(1.219e-4, 6);
    expect(b.sides).toHaveLength(6);
    expect(`${b.sides[0]!.from}→${b.sides[0]!.to}`).toBe("V10→D1");
    expect(b.sides[0]!.corrN * 1000).toBeCloseTo(-1.5, 1);
    expect(b.sides[0]!.corrE * 1000).toBeCloseTo(2.5, 1);
    expect(b.sides.reduce((a, s) => a + s.corrN, 0)).toBeCloseTo(-b.errorN, 6);
    expect(b.sides.reduce((a, s) => a + s.corrE, 0)).toBeCloseTo(-b.errorE, 6);
  });

  it("Tránsito: Σ|ΔN|, Σ|ΔE| y la corrección unitaria de cada eje", () => {
    const b = run("transit");
    if (b.method !== "transit") throw new Error(b.method);
    expect(b.sumAbsN).toBeCloseTo(83.85, 2);
    expect(b.sumAbsE).toBeCloseTo(52.085, 2);
    expect(b.factorN).toBeCloseTo(-1.002e-4, 6);
    expect(b.factorE).toBeCloseTo(2.707e-4, 6);
    expect(b.sides[0]!.corrN * 1000).toBeCloseTo(-2.1, 1);
    expect(b.sides.reduce((a, s) => a + s.corrE, 0)).toBeCloseTo(-b.errorE, 6);
  });

  it("Crandall: λ₁, λ₂ y δd de cada lado; las proyecciones salen de d + δd", () => {
    const b = run("crandall");
    if (b.method !== "crandall") throw new Error(b.method);
    expect(b.angular.perAngleSec).toBeCloseTo(-1.714, 3);
    expect(b.lambda1).toBeCloseTo(-1.125e-4, 7);
    expect(b.lambda2).toBeCloseTo(3.392e-4, 7);
    expect(b.sides[0]!.deltaD * 1000).toBeCloseTo(2.1, 1);
    expect(b.sides[4]!.deltaD * 1000).toBeCloseTo(-6.5, 1);
    for (const s of b.sides) {
      const az = (s.azimuth * Math.PI) / 180;
      expect(s.adjustedDistance * Math.cos(az)).toBeCloseTo(s.deltaN + s.corrN, 6);
    }
  });

  it("Mínimos cuadrados: la orientación es el datum y σ₀ es el del motor", () => {
    const b = run("least_squares");
    if (b.method !== "least_squares") throw new Error(b.method);
    expect(b.datumStation).toBe("V10");
    expect(b.adjustment!.angleCorrectionsSec[0]).toBeNull();
    expect(b.adjustment!.angleCorrectionsSec[1]).toBeCloseTo(-1.62, 2);
    expect(b.adjustment!.angleCorrectionsSec[6]).toBeCloseTo(-2.1, 1);
    expect(b.adjustment!.sigma0).toBeCloseTo(1.209, 3);
    expect(b.weights).toEqual({ sigmaAngleSeconds: 5, sigmaDistanceM: 0.005, distanceMeasurements: 1 });
  });

  it("una abierta sin control no tiene corrección", () => {
    const c = CARTERA_TT4;
    const input: PolygonalInput = {
      type: "open_uncontrolled",
      method: "bowditch",
      order: "ordinario",
      angleType: "interior",
      startNorth: c.startNorth,
      startEast: c.startEast,
      startAzimuth: 0,
      endNorth: null,
      endEast: null,
      endAzimuth: null,
      hasOrientation: false,
      hasClosingRow: false,
      leastSquares: null,
      stations: [],
    };
    const { result } = computePolygonalDetected(input);
    expect(correctionBreakdown(input, result)).toBeNull();
  });
});
