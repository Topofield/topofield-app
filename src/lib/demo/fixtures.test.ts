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
});
