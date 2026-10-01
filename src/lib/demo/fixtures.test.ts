import { describe, expect, it } from "vitest";
import {
  compareHomologousPoints,
  adoptedElevationsOf,
  computeLeveling,
  totalDistanceFromReadings,
} from "@/lib/calculations/leveling";
import { computeHistory } from "@/lib/calculations/settlement";
import {
  bookRowInputOf,
  computeVisitBook,
  deriveControlElevations,
} from "@/lib/calculations/settlement-book";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { ReadingInput } from "@/types/leveling";
import type { PointInput } from "@/types/settlement";
import {
  ASENTAMIENTO_DEMO,
  NIVELACION_VERJON,
  nivelacionTramo2,
  PROCESOS_DEMO,
  REFERENCIAS_DEMO,
  type LecturaNivelacionDemo,
  type NivelacionDemo,
  type ProcesoDemo,
} from "./fixtures";
import { resultadosDe } from "./insertar-poligonal";
import { generateVisitBook } from "./libreta-asentamientos";
import { ALAMEDA_OUT_OF_TOLERANCE } from "./torre-alameda";

// Fase 21: la demo son las carteras reales. Cada fixture pasa por el motor tal
// como lo harán los `insertar-*.ts`, y se comprueba lo que la cartera enseña.

function porNombre(fragmento: string): ProcesoDemo {
  const p = PROCESOS_DEMO.find((x) => x.name.includes(fragmento));
  if (!p) throw new Error(`No hay proceso demo que contenga «${fragmento}»`);
  return p;
}

const lectura = (r: LecturaNivelacionDemo): ReadingInput => ({
  pointCode: r.code,
  pointType: r.type,
  backsight: r.back ?? null,
  foresight: r.fore ?? null,
  backUpperM: null,
  backLowerM: null,
  foreUpperM: null,
  foreLowerM: null,
  backDistanceM: r.backDistanceM ?? null,
  foreDistanceM: r.foreDistanceM ?? null,
  distanceAccumulatedKm: null,
});

const nivelar = (n: NivelacionDemo) =>
  computeLeveling({
    type: n.type,
    startElevation: n.startElevation,
    endElevation: n.endElevation ?? null,
    order: n.precisionOrder,
    forward: n.forward.map(lectura),
    return: n.return ? n.return.map(lectura) : null,
  });

describe("poligonales de la demo — carteras reales", () => {
  it("tres procesos con nombres distintos", () => {
    expect(PROCESOS_DEMO).toHaveLength(3);
    expect(new Set(PROCESOS_DEMO.map((p) => p.name)).size).toBe(3);
  });

  it("la TT4 cumple —12″ de error angular, 1:7045— y nace cerrada", () => {
    const tt4 = porNombre("TT4");
    const { resultado, campos } = resultadosDe(tt4);
    expect(resultado.angularError).toBeCloseTo(12, 3);
    expect(campos.relative_precision).toBe("1:7045");
    expect(campos.meets_tolerance).toBe(true);
    expect(tt4.status).toBe("closed");
    expect(tt4.hasClosingRow).toBe(true);
  });

  it("la Vivero se ajusta por mínimos cuadrados con los pesos de la hoja", () => {
    const { resultado, campos } = resultadosDe(porNombre("Sede Vivero"));
    expect(resultado.adjustment?.status).toBe("adjusted");
    expect(campos.meets_tolerance).toBe(true);
    expect(resultado.stations.every((s) => s.north != null && s.east != null)).toBe(true);
  });

  it("la Vivero en sistema local da la misma precisión, en (1000, 2000)", () => {
    const local = resultadosDe(porNombre("sistema local"));
    const real = resultadosDe({ ...porNombre("sistema local"), startNorth: 100139.844, startEast: 101491.444 });
    expect(local.campos.relative_precision).toBe(real.campos.relative_precision);
    expect(local.resultado.stations[0]?.north).toBeCloseTo(1000, 6);
    expect(porNombre("sistema local").referenceFromCatalog).toBe(false);
  });

  it("cada amarre enlazado está en el catálogo del proyecto", () => {
    const codigos = new Set(REFERENCIAS_DEMO.map((r) => r.code));
    for (const p of PROCESOS_DEMO.filter((x) => x.referenceFromCatalog)) {
      expect(codigos.has(p.referencePointCode!)).toBe(true);
    }
  });
});

describe("nivelaciones de la demo — carteras reales", () => {
  it("El Verjón: ida y vuelta abiertas, 5.0 mm de discrepancia y sus puntos homólogos", () => {
    const r = nivelar(NIVELACION_VERJON);
    expect(NIVELACION_VERJON.type).toBe("open");
    expect(r.discrepancyMm).toBeCloseTo(5.0, 6);
    expect(r.meetsDiscrepancy).toBe(true);
    const homologos = compareHomologousPoints(r);
    expect(homologos).not.toBeNull();
    // AUX1 / AUX 1 y C 3 / «C 3 » se emparejan: los doce puntos, más la radiación.
    expect(homologos!.points.length).toBeGreaterThanOrEqual(11);
    expect(NIVELACION_VERJON.status).toBe("calculated");
  });

  it("el tramo 2 se lee del crudo con el importador y cierra en −0.4 mm sobre 1.397 km", () => {
    const tramo = nivelacionTramo2();
    const r = nivelar(tramo);
    expect(tramo.startBmCode).toBe("C10");
    expect(tramo.startElevation).toBe(2541.7545);
    expect(r.closureErrorMm).toBeCloseTo(-0.4, 6);
    expect(totalDistanceFromReadings(tramo.forward.map(lectura))).toBeCloseTo(1.397288, 6);
    expect(r.meetsTolerance).toBe(true);
    expect(tramo.status).toBe("closed");
  });

  it("el BM del tramo 2 está en el catálogo con su cota", () => {
    expect(REFERENCIAS_DEMO.find((p) => p.code === "C10")?.elevation).toBe(2541.7545);
  });
});

describe("asentamientos de la demo — Torre Alameda", () => {
  const f = ASENTAMIENTO_DEMO;
  const points: PointInput[] = f.points.map((p) => ({
    id: p.code,
    code: p.code,
    northing: p.northing,
    easting: p.easting,
    initialElevation: p.c0,
    activeFrom: null,
    retiredOn: null,
  }));
  const books = f.visits.map((v, i) => {
    const rows = generateVisitBook({
      amarre: { code: v.amarre.code, elevation: v.amarre.elevation },
      targets: v.targets,
      closureMm: v.closureMm,
      order: f.precisionOrder,
      seed: 100 + i,
    });
    const result = computeVisitBook(rows.map(bookRowInputOf), v.amarre.elevation, f.precisionOrder);
    return { result, derived: deriveControlElevations(result, points, v.date) };
  });

  it("ocho puntos, catorce visitas y los dos BMs de amarre en el catálogo", () => {
    expect(f.points).toHaveLength(8);
    expect(f.visits).toHaveLength(14);
    const codigos = new Set(REFERENCIAS_DEMO.map((r) => r.code));
    for (const v of f.visits) expect(codigos.has(v.amarre.code)).toBe(true);
    expect(new Set(f.visits.map((v) => v.amarre.code))).toEqual(new Set(["BM-1", "BM-2"]));
  });

  it("solo la visita 9 cierra fuera de tolerancia", () => {
    const fuera = books.flatMap((b, i) => (b.result.meetsTolerance === false ? [i] : []));
    expect(fuera).toEqual([ALAMEDA_OUT_OF_TOLERANCE]);
  });

  it("la libreta de cada visita reproduce la serie a 0.1 mm", () => {
    books.forEach((b, i) => {
      expect(b.derived.issues).toEqual([]);
      for (const t of f.visits[i]!.targets) {
        const got = b.derived.readings.find((r) => r.pointId === t.code)!.elevation;
        expect(Math.abs(got - t.elevation)).toBeLessThanOrEqual(0.0001 + 1e-9);
      }
    });
  });

  it("el semáforo no sale todo verde", () => {
    const history = computeHistory(
      points,
      f.visits.map((v, i) => ({
        id: `v${i}`,
        visitNumber: i,
        date: v.date,
        readings: books[i]!.derived.readings.map(({ pointId, elevation }) => ({ pointId, elevation })),
      })),
      thresholdsFor("edificio"),
    );
    const niveles = new Set(history.visits.at(-1)!.readings.map((r) => r.alertStatus));
    expect(niveles.size).toBeGreaterThan(1);
  });
});

describe("material de los informes de la demo", () => {
  it("una poligonal y una nivelación nacen cerradas, y Torre Alameda se cierra", () => {
    expect(PROCESOS_DEMO.filter((p) => p.status === "closed").map((p) => p.name)).toEqual([
      "Poligonal V10 — cartera TT4",
    ]);
    expect([NIVELACION_VERJON, nivelacionTramo2()].filter((n) => n.status === "closed")).toHaveLength(1);
  });
});

// Fase 28: ida y vuelta en la compensación, con las carteras reales. Los
// valores esperados salen de compensar El Verjón como un solo circuito
// D1 → D4 → D1 por distancia (el método de libro), calculados aparte.
describe("ida y vuelta compensadas — las carteras de la demo (Fase 28)", () => {
  const norm = (c: string) => c.replace(/\s+/g, "").toUpperCase();

  it("El Verjón se compensa como un circuito de 781.9 m con −5.0 mm de cierre", () => {
    const r = nivelar(NIVELACION_VERJON);
    expect(r.circuitClosureMm).toBeCloseTo(-5.0, 6);
    const ida = r.forward.readings;
    const vuelta = r.return!.readings;
    // El BM de partida conserva su cota al salir y al volver.
    expect(ida[0]!.elevationCorrected).toBe(3288.5);
    expect(vuelta.at(-1)!.elevationCorrected).toBeCloseTo(3288.5, 9);
    // El punto de vuelta: el promedio de ida y vuelta ponderado por distancia.
    expect(ida.at(-1)!.elevationCorrected).toBeCloseTo(3315.0855, 4);
    expect(vuelta[0]!.elevationCorrected).toBeCloseTo(ida.at(-1)!.elevationCorrected, 9);
    // C1, pasado dos veces: una cota compensada en cada pasada.
    const c1 = (rows: typeof ida) => rows.find((x) => norm(x.pointCode) === "C1")!.elevationCorrected;
    expect(c1(ida)).toBeCloseTo(3289.4414, 4);
    expect(c1(vuelta)).toBeCloseTo(3289.4386, 4);
  });

  it("y cada punto recibe una sola cota, el promedio de sus dos compensadas", () => {
    const r = nivelar(NIVELACION_VERJON);
    const adopted = adoptedElevationsOf(r, {
      type: NIVELACION_VERJON.type,
      startElevation: NIVELACION_VERJON.startElevation,
      endElevation: null,
    })!;
    const cota = (code: string) => adopted.find((a) => norm(a.pointCode) === code)!;
    expect(cota("D1")).toMatchObject({ elevation: 3288.5, known: true, readings: 2 });
    expect(cota("C1").elevation).toBeCloseTo(3289.44, 4);
    expect(cota("C5").elevation).toBeCloseTo(3302.767, 4);
    expect(cota("C8").elevation).toBeCloseTo(3313.544, 4);
    expect(cota("D4").elevation).toBeCloseTo(3315.0855, 4);
    // «AUX 1» en la ida y «AUX1» en la vuelta son el mismo punto.
    expect(cota("AUX1").readings).toBe(2);
  });

  it("los homólogos siguen comparando las cotas calculadas, sin compensar", () => {
    const h = compareHomologousPoints(nivelar(NIVELACION_VERJON))!;
    expect(h.points.at(-1)!.residualMm).toBeCloseTo(-5.0, 6);
  });

  it("el tramo 2, un recorrido que vuelve por sus puntos, da una cota por punto", () => {
    const t2 = nivelacionTramo2();
    const r = nivelar(t2);
    // Las filas se compensan como antes: C14 al ir sigue en 2542.2296.
    const c14 = r.forward.readings.filter((x) => norm(x.pointCode) === "C14");
    expect(c14.map((x) => Number(x.elevationCorrected.toFixed(4)))).toEqual([2542.2296, 2542.2246]);
    const adopted = adoptedElevationsOf(r, { type: t2.type, startElevation: t2.startElevation, endElevation: null })!;
    const cota = (code: string) => adopted.find((a) => norm(a.pointCode) === code)!;
    expect(cota("C14").elevation).toBeCloseTo(2542.2271, 4);
    expect(cota("C10")).toMatchObject({ elevation: 2541.7545, known: true, readings: 2 });
  });

  it("sin cumplir no se compensa ni hay cota adoptada", () => {
    // En primer orden, los 5.0 mm superan T·√2 = 2.63 mm.
    const r = nivelar({ ...NIVELACION_VERJON, precisionOrder: "primer_orden" });
    expect(r.meetsDiscrepancy).toBe(false);
    expect(r.forward.readings.every((x) => x.elevationCorrected === x.elevationCalculated)).toBe(true);
    expect(
      adoptedElevationsOf(r, { type: "open", startElevation: NIVELACION_VERJON.startElevation, endElevation: null }),
    ).toBeNull();
  });
});
