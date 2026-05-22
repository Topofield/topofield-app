import { describe, it, expect } from "vitest";
import { computePolygonal } from "./polygonal";
import type {
  DeflectionDirection,
  PolygonalInput,
  StationInput,
} from "@/types/polygonal";

function st(
  pointCode: string,
  angle: number,
  distance: number,
  deflectionDirection: DeflectionDirection | null = null,
): StationInput {
  return { pointCode, angle, deflectionDirection, distance };
}

function sum(nums: (number | null)[]): number {
  return nums.reduce<number>((a, n) => a + (n ?? 0), 0);
}

const BASE: Omit<PolygonalInput, "type" | "stations" | "method"> = {
  startNorth: 0,
  startEast: 0,
  startAzimuth: 0,
  endNorth: null,
  endEast: null,
  endAzimuth: null,
  order: "tercer_orden",
};

describe("computePolygonal — poligonal cerrada", () => {
  // Cuadrado perfecto de 100 m de lado: cierre exacto, error cero.
  const square = computePolygonal({
    ...BASE,
    type: "closed",
    method: "bowditch",
    stations: [st("A", 90, 100), st("B", 90, 100), st("C", 90, 100), st("D", 90, 100)],
  });

  it("verifica la suma angular contra (n-2)·180", () => {
    expect(square.angleSum).toBe(360);
    expect(square.theoreticalSum).toBe(360);
    expect(square.angularError).toBeCloseTo(0, 6);
    expect(square.anglesMeetTolerance).toBe(true);
  });

  it("encadena azimuts del cuadrado: 0°, 90°, 180°, 270°", () => {
    expect(square.stations.map((s) => s.azimuth)).toEqual([0, 90, 180, 270]);
  });

  it("cierra con error lineal ~0 y coordenadas correctas", () => {
    expect(square.linearError).toBeCloseTo(0, 6);
    expect(square.perimeter).toBe(400);
    expect(square.meetsTolerance).toBe(true);
    expect(square.stations[1]?.north).toBeCloseTo(100, 6);
    expect(square.stations[1]?.east).toBeCloseTo(0, 6);
    expect(square.stations[2]?.north).toBeCloseTo(100, 6);
    expect(square.stations[2]?.east).toBeCloseTo(100, 6);
    expect(square.stations[3]?.north).toBeCloseTo(0, 6);
    expect(square.stations[3]?.east).toBeCloseTo(100, 6);
  });
});

describe("computePolygonal — métodos de corrección", () => {
  // Cuadrado con el primer lado alargado 0.4 m: error de cierre ΔN = +0.4.
  const stations = [
    st("A", 90, 100.4),
    st("B", 90, 100),
    st("C", 90, 100),
    st("D", 90, 100),
  ];
  const closed = { ...BASE, type: "closed" as const, stations };

  it("calcula el error de cierre lineal y la precisión relativa", () => {
    const r = computePolygonal({ ...closed, method: "bowditch" });
    expect(r.errorNorth).toBeCloseTo(0.4, 6);
    expect(r.errorEast).toBeCloseTo(0, 6);
    expect(r.linearError).toBeCloseTo(0.4, 6);
    expect(r.perimeter).toBeCloseTo(400.4, 6);
    expect(r.relativePrecision).toBeCloseTo(1001, 0);
    expect(r.meetsLinearTolerance).toBe(false); // 1:1001 peor que 1:5000
  });

  it("Bowditch reparte la corrección proporcional a la distancia", () => {
    const r = computePolygonal({ ...closed, method: "bowditch" });
    expect(r.stations[1]?.north).toBeCloseTo(100.2997, 3);
    // Las proyecciones corregidas cierran (suman 0).
    expect(sum(r.stations.map((s) => s.correctedDeltaNorth))).toBeCloseTo(0, 6);
    expect(sum(r.stations.map((s) => s.correctedDeltaEast))).toBeCloseTo(0, 6);
  });

  it("Tránsito reparte según las proyecciones absolutas", () => {
    const r = computePolygonal({ ...closed, method: "transit" });
    expect(r.stations[1]?.north).toBeCloseTo(100.1996, 3);
    expect(sum(r.stations.map((s) => s.correctedDeltaNorth))).toBeCloseTo(0, 6);
  });

  it("Crandall ajusta las distancias por mínimos cuadrados", () => {
    const r = computePolygonal({ ...closed, method: "crandall" });
    expect(r.stations[1]?.north).toBeCloseTo(100.1996, 3);
    expect(sum(r.stations.map((s) => s.correctedDeltaNorth))).toBeCloseTo(0, 6);
  });
});

describe("computePolygonal — caso de estudio del marco teórico", () => {
  // Poligonal cerrada de 5 vértices (mt-poligonales.docx, caso 1).
  const pentagon = computePolygonal({
    ...BASE,
    type: "closed",
    method: "bowditch",
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
  });

  it("la suma de ángulos internos es 540° = (5-2)·180", () => {
    expect(pentagon.angleSum).toBeCloseTo(540, 6);
    expect(pentagon.theoreticalSum).toBe(540);
    expect(pentagon.angularError).toBeCloseTo(0, 6);
  });

  it("perímetro y cierre de las proyecciones corregidas", () => {
    expect(pentagon.perimeter).toBeCloseTo(554.35, 2);
    expect(sum(pentagon.stations.map((s) => s.correctedDeltaNorth))).toBeCloseTo(0, 6);
    expect(sum(pentagon.stations.map((s) => s.correctedDeltaEast))).toBeCloseTo(0, 6);
    expect(pentagon.stations[0]?.north).toBe(1000);
    expect(pentagon.stations[0]?.east).toBe(1000);
  });
});

describe("computePolygonal — abierta sin control", () => {
  // mt-poligonales.docx, caso 3: 4 estaciones, azimut de partida 150°.
  const open = computePolygonal({
    ...BASE,
    type: "open_uncontrolled",
    method: "bowditch",
    startNorth: 1000,
    startEast: 1000,
    startAzimuth: 150,
    stations: [
      st("E1", 0, 45.8),
      st("E2", 175.5, 62.3),
      st("E3", 192.25, 38.5),
      st("E4", 168, 0),
    ],
  });

  it("encadena azimuts por ángulos horizontales (150°, 145°30', 157°45')", () => {
    expect(open.stations[0]?.azimuth).toBeCloseTo(150, 6);
    expect(open.stations[1]?.azimuth).toBeCloseTo(145.5, 6);
    expect(open.stations[2]?.azimuth).toBeCloseTo(157.75, 6);
  });

  it("no tiene cierre ni corrección", () => {
    expect(open.linearError).toBeNull();
    expect(open.errorNorth).toBeNull();
    expect(open.meetsTolerance).toBeNull();
    expect(open.stations[0]?.north).toBe(1000);
  });
});

describe("computePolygonal — abierta con control", () => {
  // Tramo de enlace: arranca en (0,0) azimut 90°, deflexión 30° a la derecha.
  const stations = [st("P1", 0, 100), st("P2", 30, 100, "right"), st("P3", 0, 0)];

  it("encadena azimuts por deflexión y cierra contra el punto conocido", () => {
    const r = computePolygonal({
      ...BASE,
      type: "open_controlled",
      method: "bowditch",
      startAzimuth: 90,
      endNorth: -50,
      endEast: 186.60254,
      stations,
    });
    expect(r.stations[0]?.azimuth).toBeCloseTo(90, 6);
    expect(r.stations[1]?.azimuth).toBeCloseTo(120, 6);
    expect(r.errorNorth).toBeCloseTo(0, 4);
    expect(r.errorEast).toBeCloseTo(0, 4);
    expect(r.linearError).toBeCloseTo(0, 4);
  });

  it("corrige hasta el punto de llegada conocido", () => {
    const r = computePolygonal({
      ...BASE,
      type: "open_controlled",
      method: "bowditch",
      startAzimuth: 90,
      endNorth: -50.1,
      endEast: 186.60254,
      stations,
    });
    expect(r.errorNorth).toBeCloseTo(0.1, 4);
    // Tras corregir, la última estación coincide con el punto conocido.
    expect(r.stations[2]?.north).toBeCloseTo(-50.1, 4);
    expect(r.stations[2]?.east).toBeCloseTo(186.60254, 4);
  });
});

describe("computePolygonal — datos insuficientes", () => {
  it("no lanza y devuelve nulos con una poligonal vacía", () => {
    const r = computePolygonal({
      ...BASE,
      type: "closed",
      method: "bowditch",
      stations: [],
    });
    expect(r.stations).toEqual([]);
    expect(r.linearError).toBeNull();
    expect(r.meetsTolerance).toBeNull();
  });
});
