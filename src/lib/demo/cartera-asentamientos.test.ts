import { describe, expect, it } from "vitest";
import { detectTrendDeviations } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import { recalculateSite } from "@/lib/calculations/visit-record";
import type { PointInput } from "@/types/settlement";
import { CARTERA_ASENTAMIENTOS as C, carteraBook } from "./cartera-asentamientos";

// La cartera real (docs/carteras/Control_asentamiento_estructural_ REAL.xlsx):
// cada visita es una armada desde PISCINA/BM con una vista a cada punto. Lo
// que la hoja da en sus celdas, en mm enteros: «COMPARACION n» —el acumulado
// contra la visita 1— y «COMPARACION AL ANTERIOR» —el parcial— de C27:BQ43,
// sin la fila del BM. Las cotas, de las columnas COTA (F, K, P, U, Z, AE, AJ).

const COTAS = [
  [156.697, 156.704, 156.709, 156.696, 156.702, 156.712, 153.689, 153.634, 153.682, 153.692, 153.682, 153.689, 153.693, 153.691, 153.682, 153.689],
  [156.696, 156.702, 156.708, 156.696, 156.702, 156.711, 153.689, 153.645, 153.68, 153.692, 153.68, 153.686, 153.694, 153.694, 153.682, 153.679],
  [156.696, 156.701, 156.702, 156.695, 156.701, 156.702, 153.687, 153.644, 153.678, 153.691, 153.677, 153.683, 153.694, 153.694, 153.681, 153.629],
  [156.694, 156.695, 156.7, 156.694, 156.699, 156.7, 153.686, 153.645, 153.678, 153.69, 153.68, 153.684, 153.695, 153.695, 153.679, 153.674],
  [156.692, 156.691, 156.694, 156.693, 156.698, 156.698, 153.683, 153.644, 153.678, 153.69, 153.68, 153.683, 153.694, 153.694, 153.678, 153.674],
  [156.691, 156.69, 156.692, 156.692, 156.697, 156.697, 153.681, 153.646, 153.677, 153.689, 153.679, 153.682, 153.694, 153.694, 153.677, 153.673],
  [156.69, 156.69, 156.692, 156.691, 156.697, 156.697, 153.68, 153.646, 153.676, 153.689, 153.678, 153.682, 153.694, 153.694, 153.677, 153.672],
];

/** «COMPARACION n», de la visita 2 a la 7. */
const ACUMULADOS = [
  [-1, -2, -1, 0, 0, -1, 0, 11, -2, 0, -2, -3, 1, 3, 0, -10],
  [-1, -3, -7, -1, -1, -10, -2, 10, -4, -1, -5, -6, 1, 3, -1, -60],
  [-3, -9, -9, -2, -3, -12, -3, 11, -4, -2, -2, -5, 2, 4, -3, -15],
  [-5, -13, -15, -3, -4, -14, -6, 10, -4, -2, -2, -6, 1, 3, -4, -15],
  [-6, -14, -17, -4, -5, -15, -8, 12, -5, -3, -3, -7, 1, 3, -5, -16],
  [-7, -14, -17, -5, -5, -15, -9, 12, -6, -3, -4, -7, 1, 3, -5, -17],
];

/** «COMPARACION AL ANTERIOR», de la visita 2 a la 7. */
const PARCIALES = [
  [-1, -2, -1, 0, 0, -1, 0, 11, -2, 0, -2, -3, 1, 3, 0, -10],
  [0, -1, -6, -1, -1, -9, -2, -1, -2, -1, -3, -3, 0, 0, -1, -50],
  [-2, -6, -2, -1, -2, -2, -1, 1, 0, -1, 3, 1, 1, 1, -2, 45],
  [-2, -4, -6, -1, -1, -2, -3, -1, 0, 0, 0, -1, -1, -1, -1, 0],
  [-1, -1, -2, -1, -1, -1, -2, 2, -1, -1, -1, -1, 0, 0, -1, -1],
  [-1, 0, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0, 0, 0, 0, -1],
];

// Sin C0: la línea base de cada punto es su lectura de la visita 1.
const POINTS: PointInput[] = C.points.map((code, i) => ({
  id: `p${i}`,
  code,
  initialElevation: null,
  activeFrom: null,
  retiredOn: null,
}));

const site = recalculateSite({
  points: POINTS,
  benchmarks: [C.benchmark],
  thresholds: thresholdsFor("edificio"),
  visits: C.visits.map((v, i) => ({ id: `v${i + 1}`, visitNumber: i + 1, date: v.date, rows: carteraBook(v) })),
});
const at = (visit: number, point: number) => site[visit]!.readings.find((r) => r.pointId === `p${point}`)!;

describe("la cartera real de asentamientos (Fase 37, decisión 23)", () => {
  it("son 16 puntos y 7 visitas; la 7, del 5 de junio de 2022", () => {
    expect(C.points).toHaveLength(16);
    expect(C.visits.map((v) => v.date)).toEqual([
      "2022-03-24", "2022-03-31", "2022-04-12", "2022-04-19", "2022-04-29", "2022-05-16", "2022-06-05",
    ]);
  });

  it("cada visita es una armada sin vista adelante: calculada y sin verificación", () => {
    for (const { record } of site) {
      expect(record.header).toMatchObject({
        status: "calculated",
        precision_order: null,
        reference_bm_code: "PISCINA/BM",
        reference_bm_elevation: 156.299,
      });
      expect(record.book.tramos.map((t) => t.kind)).toEqual(["open"]);
    }
  });

  it("reproduce las cotas de la hoja", () => {
    COTAS.forEach((cotas, v) => cotas.forEach((cota, p) => expect(at(v, p).elevation).toBeCloseTo(cota, 4)));
  });

  it("reproduce «Comparación n» y «Comparación al anterior» de los 16 puntos en las 7 visitas", () => {
    for (let p = 0; p < 16; p++) {
      expect(at(0, p).accumulatedSettlement).toBe(0);
      expect(at(0, p).partialSettlement).toBeNull();
    }
    ACUMULADOS.forEach((fila, k) =>
      fila.forEach((mm, p) => expect(Math.round(at(k + 1, p).accumulatedSettlement!)).toBe(mm)),
    );
    PARCIALES.forEach((fila, k) =>
      fila.forEach((mm, p) => expect(Math.round(at(k + 1, p).partialSettlement!)).toBe(mm)),
    );
  });

  it("B10 avisa «excesiva» en la visita 3 y «contraria» en la 4", () => {
    const deviations = detectTrendDeviations(
      site.map(({ visitId, readings }, i) => ({
        visitId,
        visitNumber: i + 1,
        date: C.visits[i]!.date,
        readings,
        worstAlert: "normal" as const,
      })),
    );
    const b10 = `p${C.points.indexOf("B10")}`;
    expect(deviations.get("v3")?.get(b10)?.kind).toBe("excessive");
    expect(deviations.get("v4")?.get(b10)?.kind).toBe("contrary");
  });
});
