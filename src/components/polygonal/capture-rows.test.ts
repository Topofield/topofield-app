// Fase 35: las filas de la captura, «desde → hacia», como la hoja de campo.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import { azimuthFromCoordinates } from "@/lib/calculations/angles";
import { captureRows } from "./capture-rows";
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
    expect(rows[1]!.deflectionDirection).toBe("left");
    expect(rows[0]!.angle).toBeNull();
  });

  it("sin estaciones, solo el 0 atrás", () => {
    const rows = captureRows({ ...inputOf(CARTERA_TT4), stations: [] }, { start: "V10", reference: "TT4" });
    expect(rows.map((r) => r.role)).toEqual(["backsight"]);
  });
});
