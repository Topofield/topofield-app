// Ruta de la georreferenciación (Fase 15): de las filas de la base a lo que la
// acción escribe. Aprendizaje de la Fase 9: probar la ruta, no solo el módulo
// de cálculo. La cartera Vivero se siembra en local desde (1000, 2000) con
// azimut 0° y un amarre del catálogo, y se lleva al real con D1 y D3.

import { describe, expect, it } from "vitest";
import { planGeoreference } from "./georeference-plan";
import { CARTERA_VIVERO } from "@/lib/demo/carteras";
import type { PolygonalProcess, PolygonalStationWithReadings } from "@/types/polygonal";

const c = CARTERA_VIVERO;

function process(over: Partial<PolygonalProcess> = {}): PolygonalProcess {
  return {
    id: "p",
    name: "Vivero local",
    type: "closed",
    angle_type: "interior",
    reference_point_id: "catalogo-14-IS1",
    reference_point_code: "14_IS1",
    has_closing_row: false,
    angle_readings_min: 1,
    start_point_code: "Famarena_5",
    start_north: 1000,
    start_east: 2000,
    start_azimuth_deg: 0,
    start_azimuth_min: 0,
    start_azimuth_sec: 0,
    end_point_code: null,
    end_north: null,
    end_east: null,
    end_azimuth_deg: null,
    end_azimuth_min: null,
    end_azimuth_sec: null,
    correction_method: "bowditch",
    precision_order: "tercer_orden",
    status: "closed",
    ...over,
  } as PolygonalProcess;
}

const stations = c.stations.map(
  (s, i) =>
    ({
      id: `s${i}`,
      station_order: i + 1,
      point_code: s.pointCode,
      angle_deg: s.readings[0]![0],
      angle_min: s.readings[0]![1],
      angle_sec: s.readings[0]![2],
      deflection_direction: null,
      horizontal_distance: s.distance,
      polygonal_angle_readings: [],
    }) as unknown as PolygonalStationWithReadings,
);

const D1 = { index: 1, north: 100117.462, east: 101515.6333 };
const D3 = { index: 3, north: 100182.239, east: 101581.7814 };

describe("planGeoreference", () => {
  const planned = planGeoreference(process(), stations, D1, D3);
  if (!planned.ok) throw new Error(planned.error);
  const { plan } = planned;

  it("lleva el arranque y su azimut al sistema real", () => {
    expect(plan.header.start_north).toBeCloseTo(100139.844, 4);
    expect(plan.header.start_east).toBeCloseTo(101491.444, 4);
    expect([
      plan.header.start_azimuth_deg,
      plan.header.start_azimuth_min,
      plan.header.start_azimuth_sec,
    ]).toEqual([35, 0, 7.8]);
    expect([
      plan.header.georef_rotation_deg,
      plan.header.georef_rotation_min,
      plan.header.georef_rotation_sec,
    ]).toEqual([35, 0, 7.8]);
    expect(plan.pointCodes).toEqual(["D1", "D3"]);
  });

  it("escribe las coordenadas reales de cada estación, por su id", () => {
    const d2 = plan.stations.find((s) => s.id === "s2")!;
    expect(d2.north!).toBeCloseTo(100113.1727, 4);
    expect(d2.east!).toBeCloseTo(101528.7072, 4);
    expect(plan.stations).toHaveLength(stations.length);
  });

  it("los residuos en los puntos de control están por debajo de 0.1 mm", () => {
    for (const r of plan.residuals) expect(Math.hypot(r.north, r.east)).toBeLessThan(1e-4);
    expect(plan.scaleWithinOrder).toBe(true);
  });

  it("el amarre del catálogo pasa a manual (PRD, decisión 7)", () => {
    expect(plan.header.reference_point_id).toBeNull();
  });

  it("no toca el veredicto: el plan no lleva columnas de cierre", () => {
    expect(Object.keys(plan.header)).not.toContain("linear_error");
    expect(plan.after.linearError!).toBeCloseTo(plan.before.linearError!, 9);
  });

  it("rechaza un proceso sin coordenadas calculadas", () => {
    const sinDistancias = stations.map((s) => ({ ...s, horizontal_distance: null }));
    const r = planGeoreference(process(), sinDistancias, D1, D3);
    expect(r.ok).toBe(false);
  });

  it("rechaza el arranque repetido como segundo punto", () => {
    const r = planGeoreference(process(), stations, { ...D1, index: 0 }, { ...D3, index: 5 });
    expect(r).toEqual({ ok: false, error: "Las dos estaciones de control deben ser puntos distintos." });
  });

  it("avisa del factor de escala con 1 m de más en D3", () => {
    const r = planGeoreference(process(), stations, D1, { ...D3, north: D3.north + 1 });
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.scaleWithinOrder).toBe(false);
  });
});
