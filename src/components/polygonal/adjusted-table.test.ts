// Fase 35: la poligonal ajustada al estilo de la hoja. Cada fila es un lado
// «desde → hacia» con las coordenadas del punto al que llega.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates, decimalToDms, dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import type { PolygonalInput } from "@/types/polygonal";
import { adjustedRows } from "./adjusted-table";

const c = CARTERA_TT4;
const az = decimalToDms(azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast));
const input: PolygonalInput = {
  type: "closed",
  order: "tercer_orden",
  angleType: "interior",
  method: "bowditch",
  leastSquares: null,
  startNorth: c.startNorth,
  startEast: c.startEast,
  startAzimuth: dmsToDecimal(az.deg, az.min, az.sec),
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  hasOrientation: true,
  hasClosingRow: true,
  stations: c.stations.map((s) => ({
    pointCode: s.pointCode,
    angle: dmsToDecimal(...s.readings[0]!),
    deflectionDirection: null,
    distance: s.distance,
    readings: [],
  })),
};

describe("adjustedRows", () => {
  const result = computePolygonal(input);
  const { rows, sum } = adjustedRows(input, result, { start: "V10", reference: "TT4" });

  it("seis lados y el cierre angular, con las coordenadas del punto de llegada", () => {
    expect(rows.map((r) => `${r.from}→${r.to}`)).toEqual([
      "V10→D1",
      "D1→D2",
      "D2→D3",
      "D3→D4",
      "D4→D5",
      "D5→V10",
      "V10→TT4",
    ]);
    expect(rows[0]!.north).toBeCloseTo(100114.931312, 4);
    expect(rows[0]!.east).toBeCloseTo(101439.857597, 4);
    // El último lado vuelve a V10: el ajuste cierra.
    expect(rows[5]!.north).toBeCloseTo(c.startNorth, 6);
    expect(rows[5]!.east).toBeCloseTo(c.startEast, 6);
    // El cierre angular no abre lado.
    expect(rows[6]!.distance).toBeNull();
    expect(rows[6]!.north).toBeNull();
    expect(rows[6]!.correctedAngle).not.toBeNull();
  });

  it("la fila Σ: el perímetro, el error de cierre en las proyecciones y cero en las corregidas", () => {
    expect(sum.distance).toBeCloseTo(115.712, 6);
    expect(sum.deltaN).toBeCloseTo(result.errorNorth!, 9);
    expect(sum.deltaE).toBeCloseTo(result.errorEast!, 9);
    expect(sum.correctedN).toBeCloseTo(0, 9);
    expect(sum.correctedE).toBeCloseTo(0, 9);
  });
});
