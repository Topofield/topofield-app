// Fase 35: el borrador de la pantalla por pasos da la misma poligonal que el
// camino de siempre (`polygonalInputOf`), y la carga del guardado lleva todo.
import { describe, expect, it } from "vitest";
import { CARTERA_TT4 } from "@/lib/demo/carteras";
import { azimuthFromCoordinates, decimalToDms } from "@/lib/calculations/angles";
import { computePolygonal, computePolygonalDetected } from "@/lib/calculations/polygonal";
import { detectedOrderOf, polygonalInputOf } from "./polygonal-draft";
import { draftOf, inputOf, payloadOf } from "./polygonal-save";
import type { PolygonalProcess, PolygonalStationWithReadings } from "@/types/polygonal";

const c = CARTERA_TT4;
const az = decimalToDms(azimuthFromCoordinates(c.startNorth, c.startEast, c.referenceNorth, c.referenceEast));

const process = {
  id: "p",
  name: c.name,
  type: "closed",
  angle_type: "interior",
  location: "Sede Vivero",
  responsible_name: "Andrea Rojas",
  responsible_role: "Topógrafa",
  reference_point_id: "ref-tt4",
  reference_point_code: null,
  has_closing_row: true,
  angle_readings_min: 1,
  start_point_code: c.startPointCode,
  start_north: c.startNorth,
  start_east: c.startEast,
  start_azimuth_deg: az.deg,
  start_azimuth_min: az.min,
  start_azimuth_sec: az.sec,
  end_point_code: null,
  end_north: null,
  end_east: null,
  end_azimuth_deg: null,
  end_azimuth_min: null,
  end_azimuth_sec: null,
  correction_method: "bowditch",
  ls_sigma_angle_seconds: null,
  ls_sigma_distance_m: null,
  ls_distance_measurements: null,
  precision_order: "tercer_orden",
  equipment_brand: "Leica",
  equipment_model: "TS06 Plus",
  equipment_serial: "LCS-1",
  notes: null,
} as unknown as PolygonalProcess;

const stations = c.stations.map((s, i) => ({
  id: `s${i}`,
  station_order: i + 1,
  point_code: s.pointCode,
  angle_deg: s.readings[0]![0],
  angle_min: s.readings[0]![1],
  angle_sec: s.readings[0]![2],
  deflection_direction: null,
  horizontal_distance: s.distance,
  polygonal_angle_readings: s.readings.map(([deg, min, sec], j) => ({
    reading_order: j + 1,
    angle_deg: deg,
    angle_min: min,
    angle_sec: sec,
  })),
})) as unknown as PolygonalStationWithReadings[];

const reference = { north: c.referenceNorth, east: c.referenceEast };

describe("polygonal-save", () => {
  it("el borrador da las coordenadas de la hoja BRUJULA", () => {
    const { result } = computePolygonalDetected(inputOf(draftOf(process, stations), reference));
    const esperadas: [number, number][] = [
      [100135.666, 101440.525],
      [100114.931312, 101439.857597],
      [100108.052182, 101449.20719],
      [100106.923797, 101461.994139],
      [100143.699707, 101465.900541],
      [100148.849172, 101448.533376],
    ];
    esperadas.forEach(([n, e], i) => {
      expect(result.stations[i]!.north!).toBeCloseTo(n, 4);
      expect(result.stations[i]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("polygonalInputOf usa el orden y el tipo de ángulo detectados, no los guardados", () => {
    const viejo = { ...process, angle_type: "exterior", precision_order: null } as PolygonalProcess;
    const input = polygonalInputOf(viejo, stations);
    expect(input.order).toBe("tercer_orden");
    expect(input.angleType).toBe("interior");
    const a = computePolygonal(input);
    const { result: b } = computePolygonalDetected(inputOf(draftOf(process, stations), reference));
    expect(a.stations.map((s) => s.north)).toEqual(b.stations.map((s) => s.north));
  });

  it("la carga lleva el amarre, el cierre angular, las lecturas y los datos del alta", () => {
    const p = payloadOf("p", draftOf(process, stations));
    expect(p.referencePointId).toBe("ref-tt4");
    expect(p.referencePointCode).toBeNull();
    expect(p.hasClosingRow).toBe(true);
    expect(p.location).toBe("Sede Vivero");
    expect(p.responsibleName).toBe("Andrea Rojas");
    expect(p.equipmentSerial).toBe("LCS-1");
    expect(p.stations).toHaveLength(7);
    expect(p.stations[0]!.readings).toEqual([{ deg: 211, min: 15, sec: 7 }]);
    expect(p.stations[6]!.horizontalDistance).toBeNull();
    expect(p.lsSigmaAngleSeconds).toBeNull();
  });

  it("los pesos de mínimos cuadrados viajan con cualquier método: volver a él no los pide de nuevo", () => {
    const conPesos = {
      ...process,
      ls_sigma_angle_seconds: 2,
      ls_sigma_distance_m: 0.011,
      ls_distance_measurements: 2,
    } as PolygonalProcess;
    const p = payloadOf("p", draftOf(conPesos, stations));
    expect(p.correctionMethod).toBe("bowditch");
    expect([p.lsSigmaAngleSeconds, p.lsSigmaDistanceM, p.lsDistanceMeasurements]).toEqual([2, 0.011, 2]);
  });

  it("una estación sin lecturas guardadas toma su ángulo como única lectura", () => {
    const sin = stations.map((s) => ({ ...s, polygonal_angle_readings: [] }));
    expect(draftOf(process, sin).stations[1]!.readings).toEqual([{ deg: 124, min: 29, sec: 42 }]);
  });

  it("detectedOrderOf: el orden de lo guardado se detecta, no se lee de la columna vieja", () => {
    const viejo = { ...process, precision_order: "primer_orden" } as PolygonalProcess;
    expect(detectedOrderOf(viejo, stations)).toEqual({ order: "tercer_orden", verifiable: true });
    const abierta = { ...process, type: "open_uncontrolled" } as PolygonalProcess;
    expect(detectedOrderOf(abierta, stations)).toEqual({ order: null, verifiable: false });
  });

  // Revisión final: borrar el punto del catálogo pone `reference_point_id` en
  // null (FK `on delete set null`); con el código guardado, la poligonal sigue
  // orientada y rotulada, con el azimut que ya tenía.
  it("la referencia del catálogo viaja también con su código", () => {
    const conCodigo = { ...process, reference_point_code: "TT4" } as PolygonalProcess;
    const p = payloadOf("p", draftOf(conCodigo, stations));
    expect(p.referencePointId).toBe("ref-tt4");
    expect(p.referencePointCode).toBe("TT4");
  });

  it("una abierta sin control no guarda mínimos cuadrados: no tiene nada que ajustar", () => {
    const abierta = { ...process, type: "open_uncontrolled", correction_method: "least_squares" } as PolygonalProcess;
    expect(payloadOf("p", draftOf(abierta, stations)).correctionMethod).toBe("bowditch");
  });

  it("en una abierta la casilla de cierre angular no viaja", () => {
    const abierta = { ...process, type: "open_uncontrolled" } as PolygonalProcess;
    expect(payloadOf("p", draftOf(abierta, stations)).hasClosingRow).toBe(false);
  });
});
