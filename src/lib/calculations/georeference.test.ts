// Tests de la georreferenciación (Fase 15). Los valores esperados son los del
// PRD (docs/prds/14-georreferenciacion.md, «Pruebas»): la cartera Vivero con
// Bowditch, calculada en local desde (1000, 2000) con azimut 0°, y llevada al
// sistema real con D1 y D3.

import { describe, expect, it } from "vitest";
import {
  applyTransform,
  fitTwoPoints,
  georeferenceInput,
  scaleWithinOrder,
} from "./georeference";
import { computePolygonal } from "./polygonal";
import { azimuthFromCoordinates, decimalToDms, dmsToDecimal } from "./angles";
import { CARTERA_VIVERO } from "@/lib/demo/carteras";
import type { CorrectionMethod, PolygonalInput, PolygonalResult } from "@/types/polygonal";

/** El azimut real de arranque tal como se guarda: en DMS a 0.1″. */
function storedAzimuth(az: number): number {
  const d = decimalToDms(az);
  return dmsToDecimal(d.deg, d.min, d.sec);
}

const c = CARTERA_VIVERO;
const REAL_AZIMUTH = storedAzimuth(
  azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
);

function vivero(
  method: CorrectionMethod,
  start: { north: number; east: number; azimuth: number },
): PolygonalInput {
  return {
    type: "closed",
    method,
    order: "tercer_orden",
    angleType: c.angleType,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    startNorth: start.north,
    startEast: start.east,
    startAzimuth: start.azimuth,
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    leastSquares: { sigmaAngleSeconds: 2, sigmaDistanceM: 0.011, distanceMeasurements: 2 },
    stations: c.stations.map((s) => ({
      pointCode: s.pointCode,
      angle: dmsToDecimal(...s.readings[0]!),
      deflectionDirection: null,
      distance: s.distance,
      readings: [],
    })),
  };
}

const LOCAL_START = { north: 1000, east: 2000, azimuth: 0 };
const REAL_START = { north: c.startNorth, east: c.startEast, azimuth: REAL_AZIMUTH };

function point(r: PolygonalResult, i: number) {
  const s = r.stations[i]!;
  return { north: s.north!, east: s.east! };
}

/** Georreferencia con las estaciones `a` y `b`, tomando las reales de `real`. */
function georeference(local: PolygonalInput, real: PolygonalResult, a: number, b: number) {
  const localResult = computePolygonal(local);
  const fit = fitTwoPoints(
    point(localResult, a),
    point(localResult, b),
    point(real, a),
    point(real, b),
  )!;
  const input = georeferenceInput(local, fit.transform);
  return { fit, localResult, input, result: computePolygonal(input) };
}

function verdict(r: PolygonalResult) {
  return {
    angularError: r.angularError,
    linearError: r.linearError,
    perimeter: r.perimeter,
    relativePrecision: r.relativePrecision,
    meetsTolerance: r.meetsTolerance,
  };
}

describe("georreferenciación — Vivero local llevada al real con D1 y D3", () => {
  const real = computePolygonal(vivero("bowditch", REAL_START));
  const { fit, result } = georeference(vivero("bowditch", LOCAL_START), real, 1, 3);

  it("la rotación es el azimut real de arranque: 35°00′07.8″", () => {
    expect(decimalToDms(fit.transform.rotation)).toEqual({ deg: 35, min: 0, sec: 7.8 });
  });

  it("reproduce las coordenadas reales del PRD a 0.1 mm", () => {
    const expected: [string, number, number][] = [
      ["Famarena_5", 100139.844, 101491.444],
      ["D1", 100117.462, 101515.6333],
      ["D2", 100113.1727, 101528.7072],
      ["D3", 100182.239, 101581.7814],
      ["D4", 100193.8973, 101558.713],
    ];
    expected.forEach(([code, n, e], i) => {
      expect(result.stations[i]!.pointCode).toBe(code);
      expect(result.stations[i]!.north!).toBeCloseTo(n, 4);
      expect(result.stations[i]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("traslación y factor de escala del PRD", () => {
    expect(fit.transform.shiftNorth).toBeCloseTo(100467.9285, 4);
    expect(fit.transform.shiftEast).toBeCloseTo(99279.5759, 4);
    expect(fit.scaleFactor).toBeCloseTo(1, 9);
    expect(fit.localDistance).toBeCloseTo(92.5831, 4);
  });

  it("el veredicto no cambia", () => {
    const local = computePolygonal(vivero("bowditch", LOCAL_START));
    expect(result.angularError!).toBeCloseTo(local.angularError!, 6);
    expect(result.linearError!).toBeCloseTo(local.linearError!, 9);
    expect(result.meetsTolerance).toBe(local.meetsTolerance);
  });
});

describe("georreferenciación — invariancia por método (PRD, hallazgo 1)", () => {
  const methods: CorrectionMethod[] = ["bowditch", "transit", "crandall", "least_squares"];

  for (const method of methods) {
    it(`${method}: el veredicto es el mismo en local y en real`, () => {
      const real = computePolygonal(vivero(method, REAL_START));
      const { localResult, result } = georeference(vivero(method, LOCAL_START), real, 1, 3);
      const v = verdict(result);
      const l = verdict(localResult);
      expect(v.angularError!).toBeCloseTo(l.angularError!, 6);
      expect(v.linearError!).toBeCloseTo(l.linearError!, 9);
      expect(v.perimeter).toBe(l.perimeter);
      expect(v.relativePrecision! / l.relativePrecision!).toBeCloseTo(1, 6);
      expect(v.meetsTolerance).toBe(l.meetsTolerance);
    });
  }

  /** Mayor distancia entre recalcular en real y rotar lo calculado en local. */
  function departure(method: CorrectionMethod): number {
    const real = computePolygonal(vivero(method, REAL_START));
    const { fit, localResult, result } = georeference(vivero(method, LOCAL_START), real, 1, 3);
    return Math.max(
      ...localResult.stations.map((s, i) => {
        const moved = applyTransform(fit.transform, { north: s.north!, east: s.east! });
        return Math.hypot(moved.north - result.stations[i]!.north!, moved.east - result.stations[i]!.east!);
      }),
    );
  }

  // 0.1 mm y no menos: el arranque transformado se redondea a su columna.
  for (const method of ["bowditch", "crandall", "least_squares"] as const) {
    it(`${method}: recalcular en real es rotar lo calculado en local`, () => {
      expect(departure(method)).toBeLessThan(1e-4);
    });
  }

  it("transit: no es un movimiento rígido, con una diferencia acotada (2.66 mm)", () => {
    const d = departure("transit");
    expect(d).toBeGreaterThan(0.002);
    expect(d).toBeLessThan(0.003);
  });
});

describe("fitTwoPoints", () => {
  const t = { rotation: dmsToDecimal(123, 45, 6.7), shiftNorth: 5000.1234, shiftEast: -321.5 };
  const a = { north: 10, east: 20 };
  const b = { north: 110, east: 70 };

  it("recupera θ y t exactos de dos puntos sin ruido", () => {
    const fit = fitTwoPoints(a, b, applyTransform(t, a), applyTransform(t, b))!;
    expect(fit.transform.rotation).toBeCloseTo(t.rotation, 10);
    expect(fit.transform.shiftNorth).toBeCloseTo(t.shiftNorth, 4);
    expect(fit.transform.shiftEast).toBeCloseTo(t.shiftEast, 4);
    expect(fit.scaleFactor).toBeCloseTo(1, 12);
  });

  it("con una distancia real distinta, reparte el residuo por igual y da el factor", () => {
    const realA = applyTransform(t, a);
    const realB0 = applyTransform(t, b);
    // B se aleja 1 cm de A a lo largo de la línea.
    const len = Math.hypot(realB0.north - realA.north, realB0.east - realA.east);
    const realB = {
      north: realB0.north + ((realB0.north - realA.north) / len) * 0.01,
      east: realB0.east + ((realB0.east - realA.east) / len) * 0.01,
    };
    const fit = fitTwoPoints(a, b, realA, realB)!;
    const ra = applyTransform(fit.transform, a);
    const rb = applyTransform(fit.transform, b);
    const resA = Math.hypot(ra.north - realA.north, ra.east - realA.east);
    const resB = Math.hypot(rb.north - realB.north, rb.east - realB.east);
    expect(resA).toBeCloseTo(0.005, 4);
    expect(resB).toBeCloseTo(0.005, 4);
    expect(fit.scaleFactor).toBeCloseTo((len + 0.01) / len, 12);
  });

  it("redondea la rotación a 0.1″ y la traslación a 0.1 mm", () => {
    const odd = { rotation: 10.123456789, shiftNorth: 1.23456789, shiftEast: 9.87654321 };
    const fit = fitTwoPoints(a, b, applyTransform(odd, a), applyTransform(odd, b))!;
    expect(fit.transform.rotation * 36000).toBeCloseTo(Math.round(fit.transform.rotation * 36000), 6);
    expect(fit.transform.shiftNorth * 10000).toBeCloseTo(Math.round(fit.transform.shiftNorth * 10000), 6);
  });

  it("sin línea no hay rotación: puntos coincidentes dan null", () => {
    expect(fitTwoPoints(a, a, a, b)).toBeNull();
    expect(fitTwoPoints(a, b, a, a)).toBeNull();
  });
});

describe("georeferenceInput — abierta con control", () => {
  const input: PolygonalInput = {
    type: "open_controlled",
    method: "bowditch",
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
    stations: [
      { pointCode: "P1", angle: 0, deflectionDirection: null, distance: 100, readings: [] },
      { pointCode: "P2", angle: 90.002, deflectionDirection: "right", distance: 100, readings: [] },
      { pointCode: "P3", angle: 89.999, deflectionDirection: "right", distance: null, readings: [] },
    ],
  };
  const t = { rotation: dmsToDecimal(30, 0, 0), shiftNorth: 1000, shiftEast: 2000 };

  it("transforma también el punto y el azimut de llegada, y sigue llegando", () => {
    const moved = georeferenceInput(input, t);
    const end = applyTransform(t, { north: 100.03, east: 99.98 });
    expect(moved.endNorth!).toBeCloseTo(end.north, 4);
    expect(moved.endEast!).toBeCloseTo(end.east, 4);
    expect(moved.endAzimuth).toBeCloseTo(210, 9);
    const r = computePolygonal(moved);
    expect(r.stations.at(-1)!.north!).toBeCloseTo(moved.endNorth!, 9);
    expect(r.stations.at(-1)!.east!).toBeCloseTo(moved.endEast!, 9);
    // A la resolución de las columnas, no más: arranque y llegada se redondean
    // a 0.1 mm cada uno, y su posición relativa es el cierre de la abierta.
    expect(Math.abs(r.linearError! - computePolygonal(input).linearError!)).toBeLessThan(1e-4);
  });
});

describe("scaleWithinOrder", () => {
  it("avisa fuera de la precisión del orden: tercer orden, 1:5000", () => {
    expect(scaleWithinOrder(1.0001, "tercer_orden")).toBe(true);
    expect(scaleWithinOrder(1.0003, "tercer_orden")).toBe(false);
    // CTM12, k₀ = 0.9992: lo supera sin que haya error.
    expect(scaleWithinOrder(0.9992, "tercer_orden")).toBe(false);
  });
});
