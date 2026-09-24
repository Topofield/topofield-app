import { describe, expect, it } from "vitest";
import { computePolygonal, polygonalTraces } from "@/lib/calculations/polygonal";
import { azimuthFromCoordinates, dmsToDecimal } from "@/lib/calculations/angles";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import type { PolygonalInput, StationInput } from "@/types/polygonal";
import {
  exaggeratedPoints,
  exaggerationFactor,
  niceFloor,
  plotFrame,
  scaleBarMeters,
} from "./polygonal-plot";

function st(pointCode: string, angle: number, distance: number | null): StationInput {
  return { pointCode, angle, deflectionDirection: null, distance, readings: [{ order: 1, angle }] };
}

const BASE = {
  startNorth: 0,
  startEast: 0,
  startAzimuth: 0,
  angleType: "interior",
  hasOrientation: false,
  hasClosingRow: false,
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  order: "tercer_orden",
  method: "bowditch",
} as const;

function fromCartera(c: Cartera): PolygonalInput {
  return {
    ...BASE,
    type: "closed",
    angleType: c.angleType,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    stations: c.stations.map((s) => ({
      pointCode: s.pointCode,
      angle: dmsToDecimal(...s.readings[0]!),
      deflectionDirection: null,
      distance: s.distance,
      readings: s.readings.map((r, i) => ({ order: i + 1, angle: dmsToDecimal(...r) })),
    })),
  };
}

const trazas = (input: PolygonalInput) => polygonalTraces(input, computePolygonal(input))!;

describe("niceFloor", () => {
  it("baja al mayor 1, 2 o 5 × 10ⁿ", () => {
    expect([127.7, 451, 12.5, 1, 0.72, 5000].map(niceFloor)).toEqual([100, 200, 10, 1, 0.5, 5000]);
  });
});

describe("exaggerationFactor — los valores del PRD con datos del seed", () => {
  it("cartera TT4: ×100", () => {
    expect(exaggerationFactor(trazas(fromCartera(CARTERA_TT4)))).toBe(100);
  });

  it("cartera Vivero: ×200", () => {
    expect(exaggerationFactor(trazas(fromCartera(CARTERA_VIVERO)))).toBe(200);
  });

  it("cuadrado con error de 0.4 m: ×10", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      stations: [st("A", 90, 100.4), st("B", 90, 100), st("C", 90, 100), st("D", 90, 100)],
    };
    expect(exaggerationFactor(trazas(input))).toBe(10);
  });

  it("Pentágono del marco teórico (1:46): ×1, nunca se encoge", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      startNorth: 1000,
      startEast: 1000,
      startAzimuth: 45,
      stations: [
        st("A", 95.5, 120.5),
        st("B", 108.25, 98.75),
        st("C", 112, 135.2),
        st("D", 87.75, 110.3),
        st("E", 136.5, 89.6),
      ],
    };
    expect(exaggerationFactor(trazas(input))).toBe(1);
  });

  it("un cierre perfecto no tiene factor: no hay nada que exagerar", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      stations: [st("A", 90, 100), st("B", 90, 100), st("C", 90, 100), st("D", 90, 100)],
    };
    expect(exaggerationFactor(trazas(input))).toBeNull();
  });
});

describe("exaggeratedPoints", () => {
  it("desplaza cada vértice ×k desde su posición ajustada", () => {
    const [p] = exaggeratedPoints(
      [{ code: "A", adjusted: { north: 10, east: 20 }, unadjusted: { north: 10.01, east: 19.98 } }],
      100,
    );
    expect(p!.north).toBeCloseTo(11, 9);
    expect(p!.east).toBeCloseTo(18, 9);
  });
});

describe("plotFrame", () => {
  it("usa la misma escala en los dos ejes aunque la figura sea alargada", () => {
    const f = plotFrame(
      [
        { north: 0, east: 0 },
        { north: 10, east: 100 },
      ],
      600,
      400,
      20,
    );
    // 100 m en 560 px de ancho manda sobre 10 m en 360 px de alto.
    expect(f.metersPerPixel).toBeCloseTo(100 / 560, 9);
    const dx = f.toX(100) - f.toX(0);
    const dy = f.toY(0) - f.toY(100);
    expect(dx).toBeCloseTo(dy, 9);
  });

  it("el Norte crece hacia arriba", () => {
    const f = plotFrame([{ north: 0, east: 0 }, { north: 50, east: 50 }], 400, 400, 20);
    expect(f.toY(50)).toBeLessThan(f.toY(0));
  });

  it("un solo punto no divide por cero", () => {
    const f = plotFrame([{ north: 5, east: 5 }], 400, 400, 20);
    expect(Number.isFinite(f.metersPerPixel)).toBe(true);
    expect(f.toX(5)).toBeCloseTo(200, 9);
  });

  it("el zoom acerca alrededor del centro dado", () => {
    const puntos = [{ north: 0, east: 0 }, { north: 100, east: 100 }];
    const lejos = plotFrame(puntos, 400, 400, 0);
    const cerca = plotFrame(puntos, 400, 400, 0, { zoom: 2, center: { north: 0, east: 0 } });
    expect(cerca.metersPerPixel).toBeCloseTo(lejos.metersPerPixel / 2, 9);
    expect(cerca.toX(0)).toBeCloseTo(200, 9);
  });
});

describe("scaleBarMeters", () => {
  it("da una longitud redonda cercana al ancho pedido", () => {
    expect(scaleBarMeters(0.07, 100)).toBe(5);
  });
});
