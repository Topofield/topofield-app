// Solo para pruebas (Fase 38): los argumentos de `buildSettlementWorkbook`
// para Torre Alameda, la cartera real y un punto que se salta una visita,
// calculados como los calcula la app.

import { computeHistory } from "@/lib/calculations/settlement";
import { bookElevations, bookRowInputOf, computeBook } from "@/lib/calculations/settlement-book";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import { CARTERA_ASENTAMIENTOS, carteraBook } from "@/lib/demo/cartera-asentamientos";
import { ALAMEDA_AMARRES, ALAMEDA_POINTS, alamedaBook, alamedaVisits } from "@/lib/demo/torre-alameda";
import type { BenchmarkInput, BookRowPayload, PointInput, VisitInput } from "@/types/settlement";
import type { SettlementSheetVisit, buildSettlementWorkbook } from "./settlement-workbook";

type Args = Parameters<typeof buildSettlementWorkbook>[0];

const blank = {
  backsight: null, foresight: null, backUpperM: null, backLowerM: null,
  foreUpperM: null, foreLowerM: null, backDistanceM: null, foreDistanceM: null,
} as const;

function build(
  name: string,
  points: (PointInput & { location: string | null })[],
  benchmarks: BenchmarkInput[],
  books: { date: string; rows: BookRowPayload[] }[],
  structure: Parameters<typeof thresholdsFor>[0],
): Args {
  const visits: SettlementSheetVisit[] = books.map((b, i) => ({
    id: `v${i + 1}`, number: i + 1, date: b.date, leveler: "L. Cárdenas", equipment: null, notes: null, rows: b.rows,
  }));
  const visitInputs: VisitInput[] = visits.map((v) => {
    const inputs = v.rows.map(bookRowInputOf);
    const { readings } = bookElevations(computeBook(inputs, benchmarks, v.id), inputs, points, v.date);
    return { id: v.id, visitNumber: v.number, date: v.date, readings: readings.map(({ pointId, elevation }) => ({ pointId, elevation })) };
  });
  const thresholds = thresholdsFor(structure);
  return {
    site: { name, location: null, structure: "Edificio" },
    project: null,
    points,
    benchmarks,
    visits,
    visitInputs,
    thresholds,
    history: computeHistory(points, visitInputs, thresholds),
    warnings: [],
  };
}

const point = (code: string, initialElevation: number | null = null, location: string | null = null) => ({
  id: code, code, initialElevation, activeFrom: null, retiredOn: null, location,
});

export function siteFixture(caso: "alameda" | "cartera" | "salto"): Args {
  if (caso === "alameda") {
    return build(
      "Torre Alameda",
      ALAMEDA_POINTS.map((p) => point(p.code, p.c0, p.locationDescription)),
      ALAMEDA_AMARRES.map((a) => ({ code: a.code, elevation: a.elevation })),
      alamedaVisits().map((v, i) => ({ date: v.date, rows: alamedaBook(v, i, "tercer_orden") })),
      "edificio",
    );
  }
  if (caso === "cartera") {
    const C = CARTERA_ASENTAMIENTOS;
    return build(
      C.name,
      C.points.map((code) => point(code)),
      [{ code: C.benchmark.code, elevation: C.benchmark.elevation }],
      C.visits.map((v) => ({ date: v.date, rows: carteraBook(v) })),
      "edificio",
    );
  }
  // Tres visitas de una armada desde BM-1; P-2 no se mide en la segunda.
  const book = (p1: number, p2: number | null): BookRowPayload[] => [
    { ...blank, pointCode: "BM-1", pointType: "bm", startsSection: true, backsight: 1.5 },
    { ...blank, pointCode: "P-1", pointType: "intermediate", foresight: p1 },
    ...(p2 == null ? [] : [{ ...blank, pointCode: "P-2", pointType: "intermediate" as const, foresight: p2 }]),
  ];
  return build(
    "Salto",
    [point("P-1"), point("P-2", 100.2)],
    [{ code: "BM-1", elevation: 100 }],
    [
      { date: "2024-01-01", rows: book(1.2, 1.3) },
      { date: "2024-01-08", rows: book(1.201, null) },
      { date: "2024-01-15", rows: book(1.2015, 1.302) },
    ],
    "edificio",
  );
}
