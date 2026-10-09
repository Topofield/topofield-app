import { describe, expect, it } from "vitest";
import { computePolygonal, polygonalTraces } from "@/lib/calculations/polygonal";
import { azimuthFromCoordinates, dmsToDecimal } from "@/lib/calculations/angles";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import type { PolygonalInput, StationInput } from "@/types/polygonal";
import {
  ellipseExtremes,
  ellipseFactor,
  ellipseRotation,
  exaggeratedPoints,
  exaggerationFactor,
  MAX_PLOT_ZOOM,
  niceFloor,
  plotFrame,
  scaleBarMeters,
  zoomAt,
  type PlotViewState,
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

// Fase 39: las elipses de error se dibujan exageradas, como lo sin compensar.
describe("ellipseFactor", () => {
  const vivero = {
    ...fromCartera(CARTERA_VIVERO),
    method: "least_squares" as const,
    leastSquares: { sigmaAngleSeconds: 2, sigmaDistanceM: 0.011, distanceMeasurements: 2 },
  };
  const r = computePolygonal(vivero);
  const precision = r.adjustment?.status === "adjusted" ? r.adjustment.precision : null;

  it("cartera Vivero con los pesos de la hoja: ×500 —la mayor, de 21 mm, queda en unos 10 m—", () => {
    expect(ellipseFactor(polygonalTraces(vivero, r)!, precision!)).toBe(500);
  });

  it("lleva la mayor elipse al 15 % de la extensión, con un número redondo", () => {
    const traces = polygonalTraces(vivero, r)!;
    const k = ellipseFactor(traces, precision!)!;
    const largest = Math.max(...precision!.stations.map((p) => p?.ellipse.semiMajor ?? 0));
    const norths = traces.map((t) => t.adjusted.north);
    const easts = traces.map((t) => t.adjusted.east);
    const extent = Math.max(Math.max(...norths) - Math.min(...norths), Math.max(...easts) - Math.min(...easts));
    expect(k * largest).toBeLessThanOrEqual(0.15 * extent);
    expect(niceFloor(k)).toBe(k);
  });

  it("nunca encoge una elipse que ya se ve", () => {
    const enorme = {
      ...precision!,
      stations: precision!.stations.map((p) => (p ? { ...p, ellipse: { ...p.ellipse, semiMajor: 50 } } : null)),
    };
    expect(ellipseFactor(polygonalTraces(vivero, r)!, enorme)).toBe(1);
  });

  it("sin elipses —un ajuste perfecto, con σ₀ = 0— no hay factor", () => {
    const nulas = {
      ...precision!,
      stations: precision!.stations.map((p) => (p ? { ...p, ellipse: { semiMajor: 0, semiMinor: 0, majorAzimuth: 0 } } : null)),
    };
    expect(ellipseFactor(polygonalTraces(vivero, r)!, nulas)).toBeNull();
  });
});

describe("ellipseRotation: el giro del SVG para el eje mayor", () => {
  // En pantalla, el Este es +x y el Norte es −y. Girar (1, 0) por φ da
  // (cos φ, sen φ), que debe apuntar al azimut: (sen az, −cos az).
  it.each([0, 30, 45, 90, 132.78, 179])("con azimut %s°, el eje x girado apunta al azimut", (az) => {
    const phi = (ellipseRotation(az) * Math.PI) / 180;
    const rad = (az * Math.PI) / 180;
    expect(Math.cos(phi)).toBeCloseTo(Math.sin(rad), 12);
    expect(Math.sin(phi)).toBeCloseTo(-Math.cos(rad), 12);
  });
});

describe("ellipseExtremes: los extremos de cada elipse exagerada, para el encuadre", () => {
  const traces = [
    { code: "A", adjusted: { north: 0, east: 0 }, unadjusted: { north: 0, east: 0 } },
    { code: "B", adjusted: { north: 100, east: 0 }, unadjusted: { north: 100, east: 0 } },
  ];
  const precision = {
    confidence: 0.95,
    scale: 4.37,
    stations: [
      null,
      { sigmaNorth: 0, sigmaEast: 0, covarianceNE: 0, ellipse: { semiMajor: 0.02, semiMinor: 0.01, majorAzimuth: 0 } },
    ],
  };

  it("da los dos extremos de cada semieje, ×k, alrededor del vértice", () => {
    const pts = ellipseExtremes(traces, precision, 500);
    const near = (n: number, e: number) => pts.some((p) => Math.abs(p.north - n) < 1e-9 && Math.abs(p.east - e) < 1e-9);
    expect(pts).toHaveLength(4);
    expect(near(110, 0)).toBe(true);
    expect(near(90, 0)).toBe(true);
    expect(near(100, 5)).toBe(true);
    expect(near(100, -5)).toBe(true);
  });

  it("los puntos fijos no aportan nada", () => {
    expect(ellipseExtremes(traces.slice(0, 1), precision, 500)).toEqual([]);
  });
});

describe("zoomAt", () => {
  const W = 720;
  const H = 480;
  const pts = [
    { north: 1000, east: 2000 },
    { north: 1080, east: 2150 },
  ];
  // El encuadre como lo arma `PolygonalPlot` con una vista.
  function frameOf(view: PlotViewState) {
    const base = plotFrame(pts, W, H, 48);
    const c = { east: (base.east[0] + base.east[1]) / 2, north: (base.north[0] + base.north[1]) / 2 };
    const mpp = base.metersPerPixel / view.zoom;
    return plotFrame(pts, W, H, 48, {
      zoom: view.zoom,
      center: { east: c.east - view.offsetX * mpp, north: c.north + view.offsetY * mpp },
    });
  }

  it("deja en su sitio el punto del dibujo bajo el cursor", () => {
    const before: PlotViewState = { zoom: 3, offsetX: -40, offsetY: 25 };
    const point = { north: 1050, east: 2100 };
    const f0 = frameOf(before);
    const x = f0.toX(point.east);
    const y = f0.toY(point.north);
    const after = zoomAt(before, 2.5, x - W / 2, y - H / 2);
    const f1 = frameOf(after);
    expect(after.zoom).toBeCloseTo(7.5, 10);
    expect(f1.toX(point.east)).toBeCloseTo(x, 6);
    expect(f1.toY(point.north)).toBeCloseTo(y, 6);
  });

  it("sin punto, acerca alrededor del centro", () => {
    expect(zoomAt({ zoom: 2, offsetX: 10, offsetY: -6 }, 2)).toEqual({ zoom: 4, offsetX: 20, offsetY: -12 });
  });

  it("acota el acercamiento entre ×1 y el máximo", () => {
    expect(zoomAt({ zoom: 1.5, offsetX: 30, offsetY: 30 }, 0.25)).toEqual({ zoom: 1, offsetX: 20, offsetY: 20 });
    expect(zoomAt({ zoom: 200, offsetX: 0, offsetY: 0 }, 4).zoom).toBe(MAX_PLOT_ZOOM);
  });
});
