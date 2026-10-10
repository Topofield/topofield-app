import { describe, expect, it } from "vitest";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { PointInput } from "@/types/settlement";
import { siteReportOf, type SiteReportVisit } from "./site-data";

const P: PointInput[] = [
  { id: "p1", code: "B10", initialElevation: 100, activeFrom: null, retiredOn: null },
  { id: "p2", code: "A1", initialElevation: 50, activeFrom: null, retiredOn: null },
];

const visit = (
  n: number,
  date: string,
  b10: number,
  over: Partial<SiteReportVisit> = {},
): SiteReportVisit => ({
  id: `v${n}`,
  visitNumber: n,
  date,
  status: "calculated",
  precisionOrder: "tercer_orden",
  notes: null,
  readings: [
    { pointId: "p1", elevation: b10 },
    { pointId: "p2", elevation: 50 },
  ],
  ...over,
});

const report = (visits: SiteReportVisit[]) => siteReportOf({ thresholds: thresholdsFor("edificio"), points: P, visits });

describe("siteReportOf (Fase 37, decisión 21)", () => {
  it("solo entran las visitas calculadas; las que están en medición se nombran aparte", () => {
    const r = report([visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.997, { status: "in_progress" })]);
    expect(r.rows.map((x) => x.visitNumber)).toEqual([1]);
    expect(r.inProgress.map((v) => v.visitNumber)).toEqual([2]);
  });

  it("cada visita lleva su verificación y la primera es la base", () => {
    const r = report([
      visit(1, "2025-01-01", 100),
      visit(2, "2025-01-31", 99.997, { precisionOrder: null }),
    ]);
    expect(r.rows.map((x) => [x.base, x.verification])).toEqual([
      [true, "Tercer orden"],
      [false, "Sin verificación"],
    ]);
  });

  it("junta la nota de cada visita que la tiene", () => {
    const r = report([
      visit(1, "2025-01-01", 100),
      visit(2, "2025-01-31", 99.997, { notes: "Lluvia: B10 encharcado." }),
    ]);
    expect(r.notes).toEqual([{ visitNumber: 2, date: "2025-01-31", text: "Lluvia: B10 encharcado." }]);
    expect(r.rows[1]!.note).toBe("Lluvia: B10 encharcado.");
  });

  // −6 mm en 120 días: −1.52 mm/mes, por debajo de la precaución por velocidad.
  it("el veredicto dice la peor alerta y lo que falta al umbral siguiente", () => {
    const r = report([visit(1, "2025-01-01", 100), visit(2, "2025-05-01", 99.994)]);
    expect(r.verdict).toEqual([
      "En la visita 2 ningún punto llega a un umbral.",
      "El mayor asentamiento acumulado es -6.0 mm, en B10, a 19.0 mm de la precaución (-25 mm).",
    ]);
  });

  it("con puntos sobre un umbral, los nombra", () => {
    const r = report([visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.97)]);
    expect(r.verdict[0]).toBe("En la visita 2 la peor alerta es Alarma: B10.");
  });

  it("dice si las visitas se verifican", () => {
    expect(report([visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.997)]).verification).toBe(
      "Todas las visitas se verifican; la de menor orden alcanza el tercer orden.",
    );
    expect(
      report([
        visit(1, "2025-01-01", 100, { precisionOrder: null }),
        visit(2, "2025-01-31", 99.997, { precisionOrder: null }),
      ]).verification,
    ).toBe("Ninguna visita se verifica: las cotas son las de la medida, sin un cierre que las compruebe.");
    expect(
      report([visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.997, { precisionOrder: null })]).verification,
    ).toBe("1 de 2 visitas se verifican; las demás no cierran en un BM del lugar o no alcanzan un orden.");
  });

  it("los avisos de tendencia, con la visita de la que viene el punto", () => {
    const base = [visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.997)];
    expect(report([...base, visit(3, "2025-02-12", 99.947)]).warnings).toEqual([
      "B10 · visita 3: bajó 50.0 mm desde la visita 2; a su ritmo anterior serían unos 1.2 mm.",
    ]);
    expect(report([...base, visit(3, "2025-02-12", 100.042)]).warnings).toEqual([
      "B10 · visita 3: subió 45.0 mm desde la visita 2, contra su tendencia.",
    ]);
  });

  it("los puntos de la última visita, con su acumulado, su velocidad y su estado", () => {
    // −8 mm: pasa el margen de ruido, así que la velocidad cuenta (Fase 44).
    const r = report([visit(1, "2025-01-01", 100), visit(2, "2025-01-31", 99.992)]);
    expect(r.last?.visitNumber).toBe(2);
    expect(r.last?.points.map((p) => [p.code, p.accumulated, p.alert])).toEqual([
      ["A1", 0, "normal"],
      ["B10", -8, "alert"],
    ]);
    expect(r.last?.points[1]!.velocity).toBeCloseTo(-8.12, 2);
  });
});
