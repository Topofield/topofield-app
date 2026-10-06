// Fase 35: las filas de la captura, «desde → hacia», como la hoja de campo.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import { azimuthFromCoordinates } from "@/lib/calculations/angles";
import { computePolygonal, polygonalTraces } from "@/lib/calculations/polygonal";
import { captureRows, fieldTraverse } from "./capture-rows";
import type { PolygonalInput } from "@/types/polygonal";

function inputOf(c: Cartera): PolygonalInput {
  return {
    type: "closed",
    order: "tercer_orden",
    angleType: "interior",
    method: "bowditch",
    leastSquares: null,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast),
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
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
}

describe("captureRows", () => {
  it("la TT4: 0 atrás, seis lados y el cierre angular contra TT4", () => {
    const rows = captureRows(inputOf(CARTERA_TT4), { start: "V10", reference: "TT4" });
    expect(rows.map((r) => `${r.from}→${r.to}:${r.role}`)).toEqual([
      "V10→TT4:backsight",
      "V10→D1:side",
      "D1→D2:side",
      "D2→D3:side",
      "D3→D4:side",
      "D4→D5:side",
      "D5→V10:closing",
      "V10→TT4:closing_angle",
    ]);
    expect(rows[0]!.angle).toBe(0);
    expect(rows[0]!.stationIndex).toBeNull();
    expect(rows[1]!.stationIndex).toBe(0);
    expect(rows[7]!.distance).toBeNull();
    // El azimut del 0 atrás es el de partida; el del primer lado, el observado.
    const sec = (a: number | null) => Math.round((a ?? 0) * 3600);
    expect(sec(rows[0]!.azimuth)).toBe(Math.round((330 + 35 / 60 + 57.23 / 3600) * 3600));
    expect(sec(rows[1]!.azimuth)).toBe(Math.round((181 + 51 / 60 + 4.23 / 3600) * 3600));
  });

  it("la Vivero (sin fila de cierre): la última fila es el ángulo del vértice de arranque", () => {
    const rows = captureRows(inputOf(CARTERA_VIVERO), {
      start: CARTERA_VIVERO.startPointCode,
      reference: CARTERA_VIVERO.referencePointCode,
    });
    const last = rows.at(-1)!;
    expect(last.role).toBe("closing_angle");
    expect(last.from).toBe(CARTERA_VIVERO.startPointCode);
    expect(last.to).toBe(CARTERA_VIVERO.stations[1]!.pointCode);
    expect(last.distance).toBeNull();
    // El lado que vuelve al arranque es el cierre.
    expect(rows.at(-2)!.role).toBe("closing");
    expect(rows.at(-2)!.to).toBe(CARTERA_VIVERO.startPointCode);
  });

  it("sin referencia no hay 0 atrás", () => {
    const rows = captureRows(
      { ...inputOf(CARTERA_TT4), hasOrientation: false, hasClosingRow: false },
      { start: "V10", reference: null },
    );
    expect(rows[0]!.role).toBe("side");
    expect(rows[0]!.from).toBe("V10");
  });

  it("abierta con control: conserva el sentido de la deflexión y el último punto no tiene destino", () => {
    const input: PolygonalInput = {
      ...inputOf(CARTERA_TT4),
      type: "open_controlled",
      hasOrientation: false,
      hasClosingRow: false,
      endNorth: 0,
      endEast: 0,
      angleType: "deflection",
      stations: [
        { pointCode: "A", angle: Number.NaN, deflectionDirection: null, distance: 10, readings: [] },
        { pointCode: "B", angle: 12, deflectionDirection: "left", distance: 10, readings: [] },
        { pointCode: "C", angle: Number.NaN, deflectionDirection: null, distance: null, readings: [] },
      ],
    };
    const rows = captureRows(input, { start: "A", reference: null });
    expect(rows.map((r) => `${r.from}→${r.to}`)).toEqual(["A→B", "B→C", "C→"]);
    expect(rows[2]!.role).toBe("pending");
    expect(rows[1]!.deflectionDirection).toBe("left");
    expect(rows[0]!.angle).toBeNull();
  });

  it("abierta con control: el punto de llegada sin deflexión es la llegada, no un pendiente", () => {
    const input: PolygonalInput = {
      ...inputOf(CARTERA_TT4),
      type: "open_controlled",
      hasOrientation: false,
      hasClosingRow: false,
      endNorth: 0,
      endEast: 0,
      angleType: "deflection",
      stations: [
        { pointCode: "A", angle: Number.NaN, deflectionDirection: null, distance: 10, readings: [] },
        { pointCode: "B", angle: 12, deflectionDirection: "left", distance: 10, readings: [] },
        { pointCode: "C", angle: Number.NaN, deflectionDirection: null, distance: null, readings: [] },
      ],
    };
    expect(captureRows(input, { start: "A", reference: null, end: "C" }).at(-1)!.role).toBe("arrival");
    // Sin llegar al punto de llegada, sigue pendiente.
    expect(captureRows(input, { start: "A", reference: null, end: "Z" }).at(-1)!.role).toBe("pending");
  });

  it("una cerrada a medio capturar: el último punto es el pendiente, no un cierre", () => {
    const input = inputOf(CARTERA_TT4);
    input.stations = input.stations.slice(0, 4).map((s, i) =>
      i === 3 ? { ...s, angle: Number.NaN, distance: null } : s,
    );
    const rows = captureRows(input, { start: "V10", reference: "TT4" });
    expect(rows.at(-1)!.role).toBe("pending");
    expect(rows.at(-1)!.from).toBe("D3");
    expect(rows.at(-1)!.to).toBe("");
  });

  it("una cerrada local, sin amarre: el último lado vuelve al primer punto", () => {
    const base = { ...inputOf(CARTERA_TT4), hasOrientation: false, hasClosingRow: false };
    const pts = ["P1", "P2", "P3", "P4"].map((pointCode) => ({
      pointCode,
      angle: 90,
      deflectionDirection: null,
      distance: 10,
      readings: [],
    }));
    const done = captureRows({ ...base, stations: pts }, { start: "P1", reference: null });
    expect(done.map((r) => `${r.from}→${r.to}:${r.role}`)).toEqual([
      "P1→P2:side",
      "P2→P3:side",
      "P3→P4:side",
      "P4→P1:closing",
    ]);
    const open = captureRows(
      { ...base, stations: pts.map((p, i) => (i === 3 ? { ...p, distance: null, angle: Number.NaN } : p)) },
      { start: "P1", reference: null },
    );
    expect(open.at(-1)!.role).toBe("pending");
  });

  it("sin estaciones, solo el 0 atrás", () => {
    const rows = captureRows({ ...inputOf(CARTERA_TT4), stations: [] }, { start: "V10", reference: "TT4" });
    expect(rows.map((r) => r.role)).toEqual(["backsight"]);
  });
});

describe("fieldTraverse", () => {
  const draw = (input: PolygonalInput) => {
    const field = fieldTraverse(input);
    const result = computePolygonal(field);
    return polygonalTraces(field, result);
  };

  it("la TT4 sin ajustar: siete puntos, y el último cae junto a V10 con el error de cierre", () => {
    const points = draw(inputOf(CARTERA_TT4))!;
    expect(points.map((p) => p.code)).toEqual(["V10", "D1", "D2", "D3", "D4", "D5", "V10"]);
    const last = points.at(-1)!.adjusted;
    const gap = Math.hypot(last.north - CARTERA_TT4.startNorth, last.east - CARTERA_TT4.startEast);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(0.05);
  });

  it("a medio capturar se dibuja lo medido, hasta el punto pendiente", () => {
    const input = inputOf(CARTERA_TT4);
    input.stations = input.stations.slice(0, 4).map((s, i) => (i === 3 ? { ...s, angle: Number.NaN, distance: null } : s));
    expect(draw(input)!.map((p) => p.code)).toEqual(["V10", "D1", "D2", "D3"]);
  });

  it("una cerrada local cerrada vuelve al primer punto", () => {
    const base = { ...inputOf(CARTERA_TT4), hasOrientation: false, hasClosingRow: false, startAzimuth: 0 };
    const pts = ["P1", "P2", "P3", "P4"].map((pointCode) => ({
      pointCode,
      angle: 90,
      deflectionDirection: null,
      distance: 10,
      readings: [],
    }));
    const points = draw({ ...base, stations: pts })!;
    expect(points.map((p) => p.code)).toEqual(["P1", "P2", "P3", "P4", "P1"]);
    expect(points.at(-1)!.adjusted.north).toBeCloseTo(base.startNorth, 6);
    expect(points.at(-1)!.adjusted.east).toBeCloseTo(base.startEast, 6);
  });

  it("abierta con control: la deflexión a la izquierda gira a la izquierda", () => {
    const input: PolygonalInput = {
      ...inputOf(CARTERA_TT4),
      type: "open_controlled",
      hasOrientation: false,
      hasClosingRow: false,
      startAzimuth: 0,
      endNorth: 0,
      endEast: 0,
      angleType: "deflection",
      stations: [
        { pointCode: "A", angle: Number.NaN, deflectionDirection: null, distance: 10, readings: [] },
        { pointCode: "B", angle: 90, deflectionDirection: "left", distance: 10, readings: [] },
        { pointCode: "C", angle: Number.NaN, deflectionDirection: null, distance: null, readings: [] },
      ],
    };
    const c = draw(input)!.at(-1)!.adjusted;
    expect(c.north - input.startNorth).toBeCloseTo(10, 6);
    expect(c.east - input.startEast).toBeCloseTo(-10, 6);
  });
});
