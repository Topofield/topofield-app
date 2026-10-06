// Fase 35: cómo cambia el borrador con cada popup de la captura. La cartera TT4
// capturada medición por medición tiene que quedar igual que la de la hoja.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { computePolygonalDetected } from "@/lib/calculations/polygonal";
import {
  addClosingAngle,
  addMeasurement,
  canClose,
  closingAngleSpot,
  currentStation,
  editMeasurement,
  measuresAngle,
  needsClosingAngle,
  removeLastMeasurement,
  removeMeasurement,
} from "./capture-edits";
import { inputOf, type PolygonalDraft } from "./polygonal-save";

function empty(type: PolygonalDraft["details"]["type"] = "closed", oriented = true): PolygonalDraft {
  return {
    details: {
      name: "TT4",
      location: null,
      responsibleName: null,
      responsibleRole: null,
      type,
      equipmentBrand: null,
      equipmentModel: null,
      equipmentSerial: null,
    },
    amarre: {
      startCode: "V10",
      startNorth: 100135.666,
      startEast: 101440.525,
      referencePointId: oriented ? "ref" : null,
      referenceCode: null,
      startAzimuth: { deg: 330, min: 35, sec: 57.2 },
      endCode: null,
      endNorth: null,
      endEast: null,
      endAzimuth: null,
      hasClosingRow: false,
    },
    stations: [],
    method: "bowditch",
    lsSigmaAngleSeconds: null,
    lsSigmaDistanceM: null,
    lsDistanceMeasurements: null,
    notes: null,
  };
}

const r = (deg: number, min: number, sec: number) => [{ deg, min, sec }];

/** La TT4 tecleada como en el popup: V10→D1, D1→D2, …, D5→V10 (cierre), cierre angular. */
function capturedTT4(): PolygonalDraft {
  let d = empty();
  const cs = CARTERA_TT4.stations;
  for (let i = 0; i < 6; i++) {
    const [deg, min, sec] = cs[i]!.readings[0]!;
    d = addMeasurement(d, {
      next: i < 5 ? cs[i + 1]!.pointCode : "V10",
      readings: r(deg, min, sec),
      distance: cs[i]!.distance,
      deflectionDirection: null,
      closes: i === 5,
    });
  }
  const [deg, min, sec] = cs[6]!.readings[0]!;
  return addClosingAngle(d, { readings: r(deg, min, sec), toReference: true, deflectionDirection: null });
}

/** Sin el cierre angular: de vuelta en V10, a la espera de medirlo. */
const withoutClosingAngle = (d: PolygonalDraft): PolygonalDraft => ({
  ...d,
  stations: d.stations.map((s, i) => (i === d.stations.length - 1 ? { ...s, readings: [] } : s)),
  amarre: { ...d.amarre, hasClosingRow: false },
});

describe("capture-edits", () => {
  it("sin mediciones, se está en la estación de partida, con la referencia atrás", () => {
    expect(currentStation(empty(), "TT4")).toEqual({ index: 0, code: "V10", back: "TT4" });
  });

  it("la primera medición crea la estación de partida y el punto siguiente", () => {
    const d = addMeasurement(empty(), {
      next: "D1",
      readings: r(211, 15, 7),
      distance: 20.744,
      deflectionDirection: null,
      closes: false,
    });
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "D1"]);
    expect(d.stations[0]!.distance).toBe(20.744);
    expect(d.stations[1]!.readings).toEqual([]);
    expect(currentStation(d, "TT4")).toEqual({ index: 1, code: "D1", back: "V10" });
  });

  it("la TT4 capturada por popups es la de la hoja, con su cierre angular", () => {
    const d = capturedTT4();
    expect(d.stations.map((s) => s.pointCode)).toEqual(CARTERA_TT4.stations.map((s) => s.pointCode));
    expect(d.stations.map((s) => s.distance)).toEqual(CARTERA_TT4.stations.map((s) => s.distance));
    expect(d.stations[6]!.readings).toEqual(r(299, 18, 51));
    expect(d.amarre.hasClosingRow).toBe(true);
    expect(needsClosingAngle(d)).toBe(false);
  });

  it("tras el cierre, falta el cierre angular en la estación de partida", () => {
    const d = withoutClosingAngle(capturedTT4());
    expect(needsClosingAngle(d)).toBe(true);
    expect(closingAngleSpot(d, "TT4")).toEqual({ index: 6, at: "V10", back: "D5", ahead: "TT4" });
  });

  it("el cierre angular hacia el primer lado es el esquema de la Vivero", () => {
    const d = addClosingAngle(withoutClosingAngle(capturedTT4()), {
      readings: r(114, 24, 14),
      toReference: false,
      deflectionDirection: null,
    });
    expect(d.amarre.hasClosingRow).toBe(false);
    expect(d.stations[6]!.readings).toEqual(r(114, 24, 14));
    expect(d.stations[6]!.distance).toBeNull();
  });

  it("una cerrada sin amarre cierra con el último lado y mide al final el ángulo en P1", () => {
    let d = empty("closed", false);
    expect(measuresAngle(d, 0)).toBe(false);
    for (const [next, closes] of [["P2", false], ["P3", false], ["P1", true]] as const) {
      // Sin 0 atrás, la primera medición es solo la distancia.
      const readings = d.stations.length === 0 ? [] : r(90, 0, 0);
      d = addMeasurement(d, { next, readings, distance: 10, deflectionDirection: null, closes });
    }
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "P2", "P3"]);
    expect(d.stations[2]!.distance).toBe(10);
    expect(measuresAngle(d, 0)).toBe(true);
    expect(needsClosingAngle(d)).toBe(true);
    expect(closingAngleSpot(d, null)).toEqual({ index: 0, at: "V10", back: "P3", ahead: "P2" });
    d = addClosingAngle(d, { readings: r(90, 0, 0), toReference: false, deflectionDirection: null });
    expect(d.stations[0]!.readings).toEqual(r(90, 0, 0));
    expect(needsClosingAngle(d)).toBe(false);
    // Deshacer quita primero el ángulo en P1 y después el lado que volvía.
    d = removeLastMeasurement(d);
    expect(d.stations[0]!.readings).toEqual([]);
    expect(d.stations[2]!.distance).toBe(10);
    d = removeLastMeasurement(d);
    expect(d.stations[2]!.distance).toBeNull();
    expect(d.stations).toHaveLength(3);
  });

  it("la casilla Cierre se ofrece desde la segunda medición de una cerrada", () => {
    let d = empty();
    expect(canClose(d)).toBe(false);
    d = addMeasurement(d, { next: "D1", readings: r(211, 15, 7), distance: 20.744, deflectionDirection: null, closes: false });
    expect(canClose(d)).toBe(true);
    expect(canClose(empty("open_uncontrolled"))).toBe(false);
  });

  it("deshacer la última medición vuelve un paso: el cierre angular, el cierre y el lado anterior", () => {
    let d = removeLastMeasurement(capturedTT4());
    expect(d.stations).toHaveLength(7);
    expect(d.stations[6]!.readings).toEqual([]);
    expect(d.amarre.hasClosingRow).toBe(false);
    expect(needsClosingAngle(d)).toBe(true);
    d = removeLastMeasurement(d);
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "D1", "D2", "D3", "D4", "D5"]);
    expect(d.stations[5]!.distance).toBeNull();
    expect(d.stations[5]!.readings).toEqual([]);
    d = removeLastMeasurement(d);
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "D1", "D2", "D3", "D4"]);
    expect(d.stations[4]!.distance).toBeNull();
  });

  it("eliminar una medición intermedia quita esa estación: el siguiente punto se mide desde el anterior", () => {
    const d = removeMeasurement(capturedTT4(), 2);
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "D1", "D3", "D4", "D5", "V10"]);
    expect(d.stations[1]!.distance).toBe(CARTERA_TT4.stations[1]!.distance);
    expect(d.amarre.hasClosingRow).toBe(true);
  });

  it("eliminar el cierre angular solo vacía su ángulo; eliminar el lado que cierra quita el cierre", () => {
    const sinCierreAngular = removeMeasurement(capturedTT4(), 6);
    expect(sinCierreAngular.stations).toHaveLength(7);
    expect(sinCierreAngular.stations[6]!.readings).toEqual([]);
    expect(sinCierreAngular.amarre.hasClosingRow).toBe(false);
    const sinCierre = removeMeasurement(capturedTT4(), 5);
    expect(sinCierre.stations.map((s) => s.pointCode)).toEqual(["V10", "D1", "D2", "D3", "D4", "D5"]);
    expect(sinCierre.stations[5]!.distance).toBeNull();
  });

  it("la medición desde la estación de partida no se elimina si hay otras después", () => {
    const d = capturedTT4();
    expect(removeMeasurement(d, 0)).toBe(d);
  });

  it("a medio capturar, el cálculo no falla y no detecta orden", () => {
    const d = addMeasurement(empty(), { next: "D1", readings: r(211, 15, 7), distance: 20.744, deflectionDirection: null, closes: false });
    const { result, order } = computePolygonalDetected(inputOf(d, null));
    expect(order).toBeNull();
    expect(result.angularError).toBeNull();
  });

  it("deshacer la primera medición deja solo el amarre", () => {
    const d = addMeasurement(empty(), {
      next: "D1",
      readings: r(211, 15, 7),
      distance: 20.744,
      deflectionDirection: null,
      closes: false,
    });
    expect(removeLastMeasurement(d).stations).toEqual([]);
  });

  it("editar una medición cambia su ángulo, su distancia y el nombre del punto siguiente", () => {
    const d = editMeasurement(capturedTT4(), 1, {
      readings: r(124, 29, 40),
      distance: 11.6,
      deflectionDirection: null,
      next: "D2b",
    });
    expect(d.stations[1]!.readings).toEqual(r(124, 29, 40));
    expect(d.stations[1]!.distance).toBe(11.6);
    expect(d.stations[2]!.pointCode).toBe("D2b");
  });

  it("el punto siguiente de la estación de partida de vuelta no se renombra", () => {
    const d = editMeasurement(capturedTT4(), 5, {
      readings: r(104, 46, 7),
      distance: 15.425,
      deflectionDirection: null,
      next: "OTRO",
    });
    expect(d.stations[6]!.pointCode).toBe("V10");
  });

  it("en una cerrada local cerrada, el penúltimo punto se puede renombrar", () => {
    let d = empty("closed", false);
    for (const [next, closes] of [["P2", false], ["P3", false], ["P1", true]] as const) {
      const readings = d.stations.length === 0 ? [] : r(90, 0, 0);
      d = addMeasurement(d, { next, readings, distance: 10, deflectionDirection: null, closes });
    }
    d = editMeasurement(d, 1, { next: "P3b", readings: r(90, 0, 0), distance: 10, deflectionDirection: null });
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "P2", "P3b"]);
  });

  it("abierta con control: la casilla Llegada lleva al punto de llegada, y con azimut pide la deflexión de llegada", () => {
    const base = empty("open_controlled", false);
    let d: PolygonalDraft = {
      ...base,
      amarre: { ...base.amarre, endCode: "B9", endNorth: 1, endEast: 1, endAzimuth: { deg: 10, min: 0, sec: 0 } },
    };
    expect(canClose(d)).toBe(true);
    d = addMeasurement(d, { next: "", readings: [], distance: 10, deflectionDirection: null, closes: false });
    d = { ...d, stations: d.stations.map((s, i) => (i === 1 ? { ...s, pointCode: "B" } : s)) };
    d = addMeasurement(d, { next: "", readings: r(12, 0, 0), distance: 10, deflectionDirection: "left", closes: true });
    expect(d.stations.map((s) => s.pointCode)).toEqual(["V10", "B", "B9"]);
    expect(needsClosingAngle(d)).toBe(true);
    expect(closingAngleSpot(d, null)).toEqual({ index: 2, at: "B9", back: "B", ahead: null });
    d = addClosingAngle(d, { readings: r(5, 0, 0), toReference: false, deflectionDirection: "right" });
    expect(d.stations[2]!.readings).toEqual(r(5, 0, 0));
    expect(d.stations[2]!.deflectionDirection).toBe("right");
    // Sin azimut de llegada no hay cierre angular que medir.
    const sinAzimut = { ...d, amarre: { ...d.amarre, endAzimuth: null } };
    expect(closingAngleSpot(sinAzimut, null)).toBeNull();
  });

  it("abierta con control: conserva el sentido de la deflexión", () => {
    const d = addMeasurement(addMeasurement(empty("open_controlled", false), {
      next: "B",
      readings: [],
      distance: 10,
      deflectionDirection: null,
      closes: false,
    }), { next: "C", readings: r(12, 0, 0), distance: 10, deflectionDirection: "left", closes: false });
    expect(d.stations[1]!.deflectionDirection).toBe("left");
    expect(d.stations[0]!.readings).toEqual([]);
  });
});
