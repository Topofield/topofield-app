// Fase 35: el orden de precisión y el tipo de ángulo se detectan; los azimuts
// de la captura son los observados, sin corrección angular.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import {
  computePolygonal,
  computePolygonalDetected,
  detectAngleType,
  observedAzimuths,
} from "./polygonal";
import { detectPrecisionOrder } from "./tolerances";
import { azimuthFromCoordinates } from "./angles";
import type { PolygonalInput, PolygonalResult } from "@/types/polygonal";

function inputOf(c: Cartera): Omit<PolygonalInput, "order" | "angleType"> {
  return {
    type: "closed",
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    method: "bowditch",
    leastSquares: null,
    stations: c.stations.map((s) => {
      const [d, m, sec] = s.readings[0]!;
      return {
        pointCode: s.pointCode,
        angle: d + m / 60 + sec / 3600,
        deflectionDirection: null,
        distance: s.distance,
        readings: [],
      };
    }),
  };
}

const res = (o: Partial<PolygonalResult>): PolygonalResult =>
  ({ angularError: null, relativePrecision: null, angularConditionCount: null, ...o }) as PolygonalResult;

describe("detectPrecisionOrder", () => {
  it("la TT4: 12″ en 7 ángulos cabe en segundo orden, pero 1:7045 solo en tercero", () => {
    expect(
      detectPrecisionOrder(res({ angularError: 12, angularConditionCount: 7, relativePrecision: 7045 }), "closed"),
    ).toBe("tercer_orden");
  });

  it("en la frontera exacta de cada orden, alcanza ese orden", () => {
    expect(
      detectPrecisionOrder(
        res({ angularError: 1 * Math.sqrt(4), angularConditionCount: 4, relativePrecision: 100000 }),
        "closed",
      ),
    ).toBe("primer_orden");
    expect(
      detectPrecisionOrder(
        res({ angularError: 30 * Math.sqrt(4), angularConditionCount: 4, relativePrecision: 3000 }),
        "closed",
      ),
    ).toBe("ordinario");
  });

  it("sin alcanzar el ordinario, null", () => {
    expect(
      detectPrecisionOrder(res({ angularError: 5, angularConditionCount: 4, relativePrecision: 2999 }), "closed"),
    ).toBeNull();
    expect(
      detectPrecisionOrder(res({ angularError: 61, angularConditionCount: 4, relativePrecision: 50000 }), "closed"),
    ).toBeNull();
  });

  it("la abierta con control sin cierre angular se juzga solo por la lineal", () => {
    expect(
      detectPrecisionOrder(
        res({ angularError: null, angularConditionCount: null, relativePrecision: 25000 }),
        "open_controlled",
      ),
    ).toBe("segundo_orden");
  });

  it("sin verificación o sin datos, null", () => {
    expect(detectPrecisionOrder(res({ relativePrecision: 9999 }), "open_uncontrolled")).toBeNull();
    expect(detectPrecisionOrder(res({}), "closed")).toBeNull();
  });

  it("el cierre exacto alcanza primer orden", () => {
    expect(
      detectPrecisionOrder(res({ angularError: 0, angularConditionCount: 4, relativePrecision: Infinity }), "closed"),
    ).toBe("primer_orden");
  });
});

describe("detectAngleType", () => {
  it("la TT4 y la Vivero son interiores", () => {
    expect(detectAngleType(inputOf(CARTERA_TT4))).toBe("interior");
    expect(detectAngleType(inputOf(CARTERA_VIVERO))).toBe("interior");
  });

  it("con los ángulos exteriores (360° − interior) de un cuadrado, exterior", () => {
    const sq = {
      ...inputOf(CARTERA_TT4),
      hasOrientation: false,
      hasClosingRow: false,
      stations: [0, 1, 2, 3].map((i) => ({
        pointCode: `P${i}`,
        angle: 270,
        deflectionDirection: null,
        distance: 10,
        readings: [],
      })),
    };
    expect(detectAngleType(sq)).toBe("exterior");
  });

  it("con ángulos incompletos, interior por omisión", () => {
    const partial = { ...inputOf(CARTERA_TT4) };
    partial.stations = partial.stations.map((s, i) => (i === 2 ? { ...s, angle: Number.NaN } : s));
    expect(detectAngleType(partial)).toBe("interior");
  });
});

describe("computePolygonalDetected", () => {
  it("la TT4 sale en tercer orden, interior, con el mismo ajuste que el motor", () => {
    const { result, order, angleType } = computePolygonalDetected(inputOf(CARTERA_TT4));
    expect(order).toBe("tercer_orden");
    expect(angleType).toBe("interior");
    expect(result.angularConditionCount).toBe(7);
    expect(result.meetsTolerance).toBe(true);
    const direct = computePolygonal({ ...inputOf(CARTERA_TT4), order: "tercer_orden", angleType: "interior" });
    expect(result.stations.map((s) => s.north)).toEqual(direct.stations.map((s) => s.north));
  });
});

describe("observedAzimuths", () => {
  it("la TT4: los azimuts sin corrección angular de la hoja", () => {
    const az = observedAzimuths({ ...inputOf(CARTERA_TT4), order: "tercer_orden", angleType: "interior" });
    const sec = (a: number | null | undefined) => Math.round((a ?? 0) * 3600);
    expect(sec(az[0])).toBe(Math.round((181 + 51 / 60 + 4.23 / 3600) * 3600));
    expect(sec(az[6])).toBe(Math.round((330 + 36 / 60 + 9.23 / 3600) * 3600));
  });
});
