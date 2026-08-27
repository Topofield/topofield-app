import { describe, expect, it } from "vitest";
import { dmsToDecimal } from "@/lib/calculations/angles";
import { computePolygonal } from "@/lib/calculations/polygonal";
import { PROCESOS_DEMO, PROYECTO_DEMO, type ProcesoDemo } from "./fixtures";

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
