import { describe, expect, it } from "vitest";
import {
  compareHomologousPoints,
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
