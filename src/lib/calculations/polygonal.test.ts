import { describe, it, expect } from "vitest";
import { computePolygonal, polygonalTraces } from "./polygonal";
import { azimuthFromCoordinates, dmsToDecimal } from "./angles";
import { CARTERA_TT4, CARTERA_VIVERO, type Cartera } from "@/lib/demo/carteras";
import type {
  DeflectionDirection,
  PolygonalInput,
  StationInput,
} from "@/types/polygonal";

function st(
  pointCode: string,
  angle: number,
  distance: number | null,
  deflectionDirection: DeflectionDirection | null = null,
): StationInput {
  return {
    pointCode,
    angle,
    deflectionDirection,
    distance,
    readings: [{ order: 1, angle }],
  };
}

/** Arma la entrada del cálculo desde una cartera real de docs/carteras/. */
function fromCartera(
  c: Cartera,
  method: "bowditch" | "transit" | "crandall",
): PolygonalInput {
  return {
    type: "closed",
    method,
    order: "tercer_orden",
    angleType: c.angleType,
    hasOrientation: c.hasOrientation,
    hasClosingRow: c.hasClosingRow,
    startNorth: c.startNorth,
    startEast: c.startEast,
    startAzimuth: azimuthFromCoordinates(
      c.startNorth,
      c.startEast,
      c.referenceNorth,
      c.referenceEast,
    ),
    endNorth: null,
    endEast: null,
    endAzimuth: null,
    stations: c.stations.map((s) => ({
      pointCode: s.pointCode,
      angle: dmsToDecimal(...s.readings[0]!),
      deflectionDirection: null,
      distance: s.distance,
      readings: s.readings.map((r, i) => ({
        order: i + 1,
        angle: dmsToDecimal(...r),
      })),
    })),
  };
}

function sum(nums: (number | null)[]): number {
  return nums.reduce<number>((a, n) => a + (n ?? 0), 0);
}

const BASE: Omit<PolygonalInput, "type" | "stations" | "method"> = {
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

  it("encadena azimuts del cuadrado a la derecha: 0°, 270°, 180°, 90°", () => {
    // Con ángulos a la derecha el recorrido va al revés que con la convención
    // vieja (+180 − a), que daba [0, 90, 180, 270]. Los dos cuadrados cierran;
    // son el mismo polígono recorrido en sentidos opuestos.
    expect(square.stations.map((s) => s.azimuth)).toEqual([0, 270, 180, 90]);
  });

  it("cierra con error lineal ~0 y coordenadas correctas", () => {
    expect(square.linearError).toBeCloseTo(0, 6);
    expect(square.perimeter).toBe(400);
    expect(square.meetsTolerance).toBe(true);
    expect(square.stations[1]?.north).toBeCloseTo(100, 6);
    expect(square.stations[1]?.east).toBeCloseTo(0, 6);
    // El cuadrado sale hacia el Este negativo: con ángulos a la derecha el
    // recorrido es el espejo del que daba la convención vieja. Cierra igual.
    expect(square.stations[2]?.north).toBeCloseTo(100, 6);
    expect(square.stations[2]?.east).toBeCloseTo(-100, 6);
    expect(square.stations[3]?.north).toBeCloseTo(0, 6);
    expect(square.stations[3]?.east).toBeCloseTo(-100, 6);
  });

  it("un cierre exacto da precisión relativa 1:∞, no un número absurdo", () => {
    // linearError no es exactamente 0 en un cierre perfecto: queda un
    // residuo de punto flotante (~1e-14) por la acumulación de senos y
    // cosenos. Sin el umbral de exactitud, ese residuo produciría algo
    // como 1:17222920531038532 en lugar de 1:∞.
    expect(square.relativePrecision).toBe(Infinity);
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

  // Tramo de enlace con cierre angular: comienza apuntando al norte (az 0°), gira
  // 90° derecha en P2 (norte → este), gira 90° derecha en P3 (este → sur, az 180°).
  // El último giro conecta el último lado con la dirección de llegada conocida.
  const angularStations = [
    st("P1", 0, 100),
    st("P2", 90, 100, "right"),
    st("P3", 90, 0, "right"),
  ];

  it("cierra angularmente contra el azimut conocido", () => {
    const r = computePolygonal({
      ...BASE,
      type: "open_controlled",
      method: "bowditch",
      startAzimuth: 0,
      endNorth: 100,
      endEast: 100,
      endAzimuth: 180,
      stations: angularStations,
    });
    expect(r.angularError).toBeCloseTo(0, 4);
    expect(r.anglesMeetTolerance).toBe(true);
    expect(r.linearError).toBeCloseTo(0, 4);
    expect(r.meetsTolerance).toBe(true);
  });

  it("distribuye el error angular entre las deflexiones", () => {
    // Misma geometría pero con la deflexión final 1° corta: 89° en vez de 90°.
    const off = [
      st("P1", 0, 100),
      st("P2", 90, 100, "right"),
      st("P3", 89, 0, "right"),
    ];
    const r = computePolygonal({
      ...BASE,
      type: "open_controlled",
      method: "bowditch",
      startAzimuth: 0,
      endNorth: 100,
      endEast: 100,
      endAzimuth: 180,
      stations: off,
    });
    // Error angular = (calc 179°) − (conocido 180°) = −1° = −3600″.
    expect(r.angularError).toBeCloseTo(-3600, 1);
    // La distribución reparte +0.5° a cada una de las dos deflexiones, así
    // que el azimut del segundo lado pasa de 90° a 90.5°.
    expect(r.stations[1]?.azimuth).toBeCloseTo(90.5, 4);
    // Tras la corrección lineal posterior, la coordenada final coincide con
    // el punto de llegada conocido.
    expect(r.stations[2]?.north).toBeCloseTo(100, 4);
    expect(r.stations[2]?.east).toBeCloseTo(100, 4);
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

describe("computePolygonal — cartera real TT4 (docs/carteras/poligonales.xlsx)", () => {
  const bowditch = computePolygonal(fromCartera(CARTERA_TT4, "bowditch"));

  it("suma 1080°00'12\" contra una teórica de 1080° con orientación y cierre", () => {
    expect(bowditch.theoreticalSum).toBe(1080);
    expect(bowditch.angleSum).toBeCloseTo(1080.003333, 6);
    expect(bowditch.angularError).toBeCloseTo(12, 3);
  });

  it("reparte el error entre los 7 ángulos medidos, no entre los 6 vértices", () => {
    const aplicada =
      dmsToDecimal(211, 15, 7) - (bowditch.stations[0]!.correctedAngle ?? 0);
    expect(aplicada * 3600).toBeCloseTo(1.714286, 4);
  });

  it("encadena los azimuts de la hoja sumando el ángulo a la derecha", () => {
    const esperados = [
      181.850699, 126.345223, 95.039469, 6.055937, 286.517405, 211.28554,
    ];
    esperados.forEach((az, i) =>
      expect(bowditch.stations[i]?.azimuth).toBeCloseTo(az, 5),
    );
  });

  it("da el mismo error de cierre y perímetro que la hoja", () => {
    expect(bowditch.errorNorth).toBeCloseTo(0.008417, 6);
    expect(bowditch.errorEast).toBeCloseTo(-0.014104, 6);
    expect(bowditch.linearError).toBeCloseTo(0.016425, 6);
    expect(bowditch.perimeter).toBeCloseTo(115.712, 6);
  });

  it("el control de reorientación recupera el azimut de amarre", () => {
    expect(bowditch.reorientationError).toBeCloseTo(0, 3);
  });

  it("reproduce las coordenadas de la hoja BRUJULA dentro de 0.1 mm", () => {
    const esperadas: [number, number][] = [
      [100135.666, 101440.525],
      [100114.931312, 101439.857597],
      [100108.052182, 101449.20719],
      [100106.923797, 101461.994139],
      [100143.699707, 101465.900541],
      [100148.849172, 101448.533376],
    ];
    esperadas.forEach(([n, e], i) => {
      expect(bowditch.stations[i]!.north!).toBeCloseTo(n, 4);
      expect(bowditch.stations[i]!.east!).toBeCloseTo(e, 4);
    });
  });

  it("Tránsito cierra a cero, cosa que la hoja del Excel tampoco hace", () => {
    // La hoja TRANSITO reparte proporcional a la proyección CON SIGNO
    // ((ΣΔN/Σ|ΔN|)·ΔNᵢ). Como ΣΔNᵢ es justamente el error de cierre, las
    // correcciones se cancelan entre sí: suman 0.000002 en vez de −0.008417,
    // o sea que la hoja deja el error entero sin corregir y vuelve al arranque
    // desviada 8.42 mm en N y 14.1 mm en E.
    //
    // La regla de tránsito clásica reparte proporcional al VALOR ABSOLUTO
    // |ΔNᵢ|, y así las correcciones suman exactamente −E_N. Es lo que hace
    // correctDeltas, y por eso aquí se verifica el cierre y no la paridad con
    // la hoja.
    const r = computePolygonal(fromCartera(CARTERA_TT4, "transit"));
    const sumaN = r.stations.reduce((a, s) => a + (s.correctedDeltaNorth ?? 0), 0);
    const sumaE = r.stations.reduce((a, s) => a + (s.correctedDeltaEast ?? 0), 0);
    expect(sumaN).toBeCloseTo(0, 9);
    expect(sumaE).toBeCloseTo(0, 9);
  });

  it("Crandall cierra a cero, cosa que la hoja del Excel no hace", () => {
    // La hoja CRANDALL usa (ΔN+ΔE)/d donde van el producto ΔN·ΔE/d, Σ(LDᵢ²)
    // donde va (Σ LD)², y tiene los paréntesis mal puestos en los
    // multiplicadores. Por eso vuelve a V10 con 0.22 mm de residuo en N y
    // 0.09 mm en E. El nuestro cierra: no replicamos el error de la hoja.
    const r = computePolygonal(fromCartera(CARTERA_TT4, "crandall"));
    const sumaN = r.stations.reduce((a, s) => a + (s.correctedDeltaNorth ?? 0), 0);
    const sumaE = r.stations.reduce((a, s) => a + (s.correctedDeltaEast ?? 0), 0);
    expect(sumaN).toBeCloseTo(0, 9);
    expect(sumaE).toBeCloseTo(0, 9);
  });
});

describe("computePolygonal — cartera Vivero (cierre contra el primer lado)", () => {
  const r = computePolygonal(fromCartera(CARTERA_VIVERO, "bowditch"));

  it("excluye el ángulo de orientación de la suma: 540° sobre 5 ángulos", () => {
    expect(r.theoreticalSum).toBe(540);
    expect(r.angleSum).toBeCloseTo(539.998889, 6);
    expect(r.angularError).toBeCloseTo(-4, 2);
  });

  it("el control de reorientación compara contra el azimut del primer lado", () => {
    expect(r.reorientationError).not.toBeNull();
    expect(Math.abs(r.reorientationError!)).toBeLessThan(1);
  });

  it("cierra: las proyecciones corregidas suman cero", () => {
    const sumaN = r.stations.reduce((a, s) => a + (s.correctedDeltaNorth ?? 0), 0);
    expect(sumaN).toBeCloseTo(0, 9);
  });
});

describe("computePolygonal — ángulos exteriores", () => {
  // No hay cartera real de ángulos exteriores, así que el caso se cubre con un
  // cuadrado recorrido de modo que las lecturas a la derecha caigan como
  // exteriores: 270° en cada vértice, suma (4+2)·180 = 1080.
  //
  // OJO: NO sirve tomar el complemento a 360° de una cartera interior. Bajo
  // Az(i) = Az(i-1) + 180 + a, sustituir a por 360 − a devuelve exactamente la
  // fórmula vieja (+180 − a), o sea el polígono espejo — el bug que esta fase
  // corrige.
  const square = computePolygonal({
    ...BASE,
    type: "closed",
    angleType: "exterior",
    method: "bowditch",
    stations: [
      st("A", 270, 100),
      st("B", 270, 100),
      st("C", 270, 100),
      st("D", 270, 100),
    ],
  });

  it("usa (n+2)·180 como suma teórica", () => {
    expect(square.theoreticalSum).toBe(1080);
    expect(square.angleSum).toBe(1080);
    expect(square.angularError).toBeCloseTo(0, 6);
  });

  it("cierra el cuadrado con azimuts 0°, 90°, 180°, 270°", () => {
    expect(square.stations.map((s) => s.azimuth)).toEqual([0, 90, 180, 270]);
    expect(square.linearError).toBeCloseTo(0, 6);
  });
});

// ============================================================================
// Fase 13 — trazas para el dibujo
// ============================================================================

describe("polygonalTraces — la sin compensar cierra con el error de cierre", () => {
  const casos: [string, PolygonalInput][] = [
    ["TT4 (bowditch)", fromCartera(CARTERA_TT4, "bowditch")],
    ["TT4 (transit)", fromCartera(CARTERA_TT4, "transit")],
    ["TT4 (crandall)", fromCartera(CARTERA_TT4, "crandall")],
    ["Vivero (bowditch)", fromCartera(CARTERA_VIVERO, "bowditch")],
    [
      "Pentágono del marco teórico",
      {
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
      },
    ],
  ];

  it.each(casos)("%s: último sin compensar − arranque = (errorNorth, errorEast)", (_, input) => {
    const result = computePolygonal(input);
    const trazas = polygonalTraces(input, result)!;
    const ultimo = trazas.at(-1)!;
    expect(ultimo.unadjusted.north - input.startNorth).toBeCloseTo(result.errorNorth!, 9);
    expect(ultimo.unadjusted.east - input.startEast).toBeCloseTo(result.errorEast!, 9);
    // Ajustada: vuelve al arranque, y cada vértice coincide con el del motor.
    expect(ultimo.adjusted.north).toBeCloseTo(input.startNorth, 9);
    expect(ultimo.adjusted.east).toBeCloseTo(input.startEast, 9);
    trazas.slice(0, -1).forEach((t, i) => {
      expect(t.adjusted.north).toBeCloseTo(result.stations[i]!.north!, 9);
      expect(t.adjusted.east).toBeCloseTo(result.stations[i]!.east!, 9);
    });
    // El punto de cierre lleva el código del arranque.
    expect(ultimo.code).toBe(input.stations[0]!.pointCode);
  });

  it("un cierre perfecto no separa las dos trazas", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      method: "bowditch",
      startAzimuth: 0,
      stations: [st("A", 90, 100), st("B", 90, 100), st("C", 90, 100), st("D", 90, 100)],
    };
    const trazas = polygonalTraces(input, computePolygonal(input))!;
    for (const t of trazas) {
      expect(t.unadjusted.north).toBeCloseTo(t.adjusted.north, 9);
      expect(t.unadjusted.east).toBeCloseTo(t.adjusted.east, 9);
    }
  });

  it("abierta con control: la sin compensar termina a (errorNorth, errorEast) del punto de llegada", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "open_controlled",
      method: "bowditch",
      startAzimuth: 90,
      endNorth: -50.1,
      endEast: 186.60254,
      stations: [st("P1", 0, 100), st("P2", 30, 100, "right"), st("P3", 0, 0)],
    };
    const result = computePolygonal(input);
    const trazas = polygonalTraces(input, result)!;
    expect(trazas.map((t) => t.code)).toEqual(["P1", "P2", "P3"]);
    const ultimo = trazas.at(-1)!;
    expect(ultimo.adjusted.north).toBeCloseTo(-50.1, 6);
    expect(ultimo.adjusted.east).toBeCloseTo(186.60254, 6);
    expect(ultimo.unadjusted.north - ultimo.adjusted.north).toBeCloseTo(result.errorNorth!, 9);
    expect(ultimo.unadjusted.east - ultimo.adjusted.east).toBeCloseTo(result.errorEast!, 9);
  });

  it("abierta sin control: las dos trazas coinciden", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "open_uncontrolled",
      method: "bowditch",
      startNorth: 1000,
      startEast: 1000,
      startAzimuth: 150,
      stations: [st("E1", 0, 45.8), st("E2", 175.5, 62.3), st("E3", 192.25, 38.5), st("E4", 168, 0)],
    };
    const result = computePolygonal(input);
    const trazas = polygonalTraces(input, result)!;
    expect(trazas).toHaveLength(4);
    trazas.forEach((t, i) => {
      expect(t.unadjusted).toEqual(t.adjusted);
      expect(t.adjusted.north).toBeCloseTo(result.stations[i]!.north!, 9);
    });
  });

  it("devuelve null si falta el arranque, aunque las proyecciones sean finitas", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      method: "bowditch",
      startNorth: Number.NaN,
      stations: [st("A", 90, 100), st("B", 90, 100), st("C", 90, 100), st("D", 90, 100)],
    };
    expect(polygonalTraces(input, computePolygonal(input))).toBeNull();
  });

  it("devuelve null mientras falten datos", () => {
    const input: PolygonalInput = {
      ...BASE,
      type: "closed",
      method: "bowditch",
      stations: [st("A", 90, 100), st("B", 90, null)],
    };
    expect(polygonalTraces(input, computePolygonal(input))).toBeNull();
  });
});
