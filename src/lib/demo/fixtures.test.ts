import { describe, expect, it } from "vitest";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { computeLeveling } from "@/lib/calculations/leveling";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { computeHistory } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import {
  ASENTAMIENTO_DEMO,
  NIVELACION_DEMO,
  PROCESOS_DEMO,
  PROYECTO_DEMO,
  type ProcesoDemo,
} from "./fixtures";

/** Pasa un fixture por el motor real, con el orden del proyecto demo. */
function calcular(proceso: ProcesoDemo) {
  return computePolygonal({
    type: proceso.type,
    startNorth: proceso.startNorth,
    startEast: proceso.startEast,
    startAzimuth: dmsToDecimal(...proceso.startAz),
    endNorth: proceso.endNorth ?? null,
    endEast: proceso.endEast ?? null,
    endAzimuth: null,
    order: PROYECTO_DEMO.precisionOrder,
    method: proceso.correctionMethod ?? "bowditch",
    stations: proceso.stations.map((st) => ({
      pointCode: st.code,
      angle: st.angle ? dmsToDecimal(...st.angle) : Number.NaN,
      deflectionDirection: st.dir ?? null,
      distance: st.distance ?? Number.NaN,
    })),
  });
}

function porNombre(fragmento: string): ProcesoDemo {
  const p = PROCESOS_DEMO.find((x) => x.name.includes(fragmento));
  if (!p) throw new Error(`No hay proceso demo que contenga «${fragmento}»`);
  return p;
}

describe("fixtures del proyecto demo", () => {
  it("todos tienen estaciones y nombre", () => {
    expect(PROCESOS_DEMO.length).toBeGreaterThan(0);
    for (const p of PROCESOS_DEMO) {
      expect(p.name.trim()).not.toBe("");
      expect(p.stations.length).toBeGreaterThan(0);
    }
  });

  it("no repite nombres: el listado los muestra juntos", () => {
    const nombres = PROCESOS_DEMO.map((p) => p.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("cubre los tres tipos de poligonal", () => {
    const tipos = new Set(PROCESOS_DEMO.map((p) => p.type));
    expect(tipos).toEqual(
      new Set(["closed", "open_controlled", "open_uncontrolled"]),
    );
  });

  // Lo que de verdad importa: que la demo no se contradiga a sí misma. Si
  // alguien toca las coordenadas, esto falla antes de que un usuario vea un
  // proceso que dice «cierre conforme» y sale en rojo.
  it("el «cierre conforme» efectivamente cumple la tolerancia", () => {
    const r = calcular(porNombre("cierre conforme"));
    expect(r.meetsTolerance).toBe(true);
  });

  it("el «error de cierre» efectivamente NO cumple la tolerancia", () => {
    const r = calcular(porNombre("error de cierre"));
    expect(r.meetsTolerance).toBe(false);
  });

  it("el levantamiento de reconocimiento no tiene verificación de cierre", () => {
    const r = calcular(porNombre("reconocimiento"));
    expect(r.meetsTolerance).toBeNull();
  });

  it("el enlace entre puntos de control sí se verifica", () => {
    const r = calcular(porNombre("Enlace"));
    expect(r.linearError).not.toBeNull();
  });

  // El generador del proyecto de ejemplo persiste, además de los campos de
  // cabecera, los RESULTADOS POR ESTACIÓN (ángulo corregido, azimut,
  // proyecciones y coordenadas). Durante tres fases no lo hizo, y nadie lo
  // notó: el editor recalcula en vivo, así que la aplicación se veía bien y
  // solo el informe y la exportación a Excel —que leen lo persistido— salían
  // con las celdas vacías. Este test fija que el motor sí produce esos valores
  // para los fixtures que se muestran al usuario nuevo.
  it("el motor produce coordenadas para todas las estaciones de la demo", () => {
    for (const proceso of PROCESOS_DEMO) {
      const r = calcular(proceso);
      expect(r.stations).toHaveLength(proceso.stations.length);
      for (const st of r.stations) {
        expect(st.north).not.toBeNull();
        expect(st.east).not.toBeNull();
        expect(Number.isFinite(st.north as number)).toBe(true);
        expect(Number.isFinite(st.east as number)).toBe(true);
      }
    }
  });

  it("el motor produce azimut para las estaciones que lo tienen definido", () => {
    for (const proceso of PROCESOS_DEMO) {
      const r = calcular(proceso);
      const conAzimut = r.stations.filter((st) => st.azimuth != null);
      expect(conAzimut.length).toBeGreaterThan(0);
    }
  });
});

describe("fixture de nivelación del demo", () => {
  it("es un circuito cerrado y conforme (alimenta su informe)", () => {
    const result = computeLeveling({
      type: NIVELACION_DEMO.type,
      startElevation: NIVELACION_DEMO.startElevation,
      endElevation: NIVELACION_DEMO.endElevation ?? null,
      order: PROYECTO_DEMO.precisionOrder,
      totalDistanceKm: NIVELACION_DEMO.totalDistanceKm,
      forward: NIVELACION_DEMO.forward.map((r) => ({
        pointCode: r.code,
        pointType: r.type,
        backsight: r.back ?? null,
        foresight: r.fore ?? null,
        distanceM: r.distanceM ?? null,
        distanceAccumulatedKm: r.distanceAccumKm ?? null,
      })),
      return: null,
    });

    expect(NIVELACION_DEMO.type).toBe("closed");
    expect(result.closureErrorMm).not.toBeNull();
    expect(result.toleranceMm).not.toBeNull();
    // Conforme: el error de cierre queda por debajo de la tolerancia.
    expect(Math.abs(result.closureErrorMm as number)).toBeLessThan(
      result.toleranceMm as number,
    );
    expect(result.meetsTolerance).toBe(true);
  });
});

describe("fixture de asentamientos del demo", () => {
  function cotaEn(code: string, initialElevation: number, i: number): number {
    const acc = ASENTAMIENTO_DEMO.partialsMm[code]!
      .slice(0, i + 1)
      .reduce((a, b) => a + b, 0);
    return initialElevation + acc / 1000;
  }

  function historia() {
    const points = ASENTAMIENTO_DEMO.points.map((p) => ({
      id: p.code,
      code: p.code,
      northing: p.northing,
      easting: p.easting,
      initialElevation: p.initialElevation,
    }));
    const visits = ASENTAMIENTO_DEMO.visitDates.map((date, i) => ({
      id: `v-${i}`,
      visitNumber: i,
      date,
      readings: ASENTAMIENTO_DEMO.points.map((p) => ({
        pointId: p.code,
        elevation: cotaEn(p.code, p.initialElevation, i),
      })),
    }));
    return computeHistory(points, visits, thresholdsFor("edificio"));
  }

  it("cada punto tiene un parcial por cada fecha de visita", () => {
    for (const p of ASENTAMIENTO_DEMO.points) {
      expect(ASENTAMIENTO_DEMO.partialsMm[p.code]).toHaveLength(
        ASENTAMIENTO_DEMO.visitDates.length,
      );
    }
  });

  it("el semáforo no sale todo verde: hay variedad de alertas", () => {
    const history = historia();
    const todas = history.visits.flatMap((v) =>
      v.readings.map((r) => r.alertStatus),
    );
    expect(new Set(todas).size).toBeGreaterThan(1);
  });

  it("P-06 (esquina más cargada) llega a alarma en alguna visita", () => {
    const history = historia();
    const p06 = history.visits.flatMap((v) =>
      v.readings.filter((r) => r.pointId === "P-06").map((r) => r.alertStatus),
    );
    expect(p06).toContain("alarm");
  });
});

describe("material de los informes del demo", () => {
  it("hay exactamente una poligonal cerrada, y es el «cierre conforme»", () => {
    const cerradas = PROCESOS_DEMO.filter((p) => p.status === "closed");
    expect(cerradas).toHaveLength(1);
    expect(cerradas[0]!.name).toContain("cierre conforme");
  });
});
