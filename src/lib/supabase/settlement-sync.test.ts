import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { pointInputOf } from "@/lib/calculations/settlement";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import { recalculateSite } from "@/lib/calculations/visit-record";
import { CARTERA_ASENTAMIENTOS as C, carteraBook } from "@/lib/demo/cartera-asentamientos";
import { recomputeSite } from "./settlement-sync";

type Result = { data: unknown; error: { message: string; code?: string } | null };

/**
 * Un cliente mínimo: cada tabla responde lo que se le da, con cualquier
 * filtro. Como PostgREST, corta en 1000 filas por petición (`max_rows`), con
 * `range` o sin él.
 */
function fakeClient(tables: Record<string, Result>): SupabaseClient {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      let range: [number, number] = [0, Infinity];
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
      chain.range = (from: number, to: number) => {
        range = [from, to];
        return chain;
      };
      chain.maybeSingle = () => Promise.resolve(result);
      const page = (): Result =>
        Array.isArray(result.data)
          ? { ...result, data: result.data.slice(range[0], Math.min(range[1] + 1, range[0] + 1000)) }
          : result;
      chain.then = (ok: (r: Result) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(page()).then(ok, ko);
      return chain;
    },
  } as unknown as SupabaseClient;
}

const SITE = {
  id: "s1",
  velocity_caution: 2, velocity_alert: 5, velocity_alarm: 10,
  accumulated_caution: 25, accumulated_alert: 50, accumulated_alarm: 75,
};

describe("recomputeSite (Fase 37)", () => {
  it("un error al leer los BM del lugar no pasa por «al día»", async () => {
    const r = await recomputeSite(
      fakeClient({
        sites: { data: SITE, error: null },
        site_benchmarks: { data: null, error: { message: 'relation "site_benchmarks" does not exist', code: "42P01" } },
      }),
      "s1",
      { dryRun: true },
    );
    expect(r.ok).toBe(false);
  });

  it("sin visitas, el lugar está al día", async () => {
    const r = await recomputeSite(fakeClient({ sites: { data: SITE, error: null } }), "s1", { dryRun: true });
    expect(r).toEqual({ ok: true, visits: 0, changedVisits: 0, changedReadings: 0 });
  });
});

describe("recomputeSite con más de 1000 filas (revisión final de la Fase 37)", () => {
  // 70 visitas de la cartera: 1190 filas de libreta y 1120 lecturas, todas al
  // día. PostgREST corta cada petición en 1000: sin paginar, la simulación
  // veía libretas mochas y lecturas que faltaban.
  const points = C.points.map((code, i) => ({
    id: `p${i}`, site_id: "s1", code, location_description: "", initial_elevation: null,
    active_from: null, retired_on: null, retirement_reason: null,
  }));
  const visits = Array.from({ length: 70 }, (_, k) => {
    const base = C.visits[k % C.visits.length]!;
    const date = new Date(Date.UTC(2022, 0, 1 + k * 7)).toISOString().slice(0, 10);
    return { id: `v${k}`, visit_number: k, date, rows: carteraBook(base) };
  });
  const books = visits.flatMap((v) =>
    v.rows.map((row, i) => ({
      visit_id: v.id, reading_order: i + 1, point_code: row.pointCode, point_type: row.pointType,
      starts_section: Boolean(row.startsSection), backsight: row.backsight, foresight: row.foresight,
      back_upper_m: null, back_lower_m: null, fore_upper_m: null, fore_lower_m: null,
      back_distance_m: null, fore_distance_m: null,
    })),
  );
  const visitRows = visits.map((v) => ({ id: v.id, visit_number: v.visit_number, date: v.date }));
  const stored = recalculateSite({
    points: points.map(pointInputOf),
    benchmarks: [C.benchmark],
    thresholds: thresholdsFor("edificio"),
    visits: visits.map((v) => ({ id: v.id, visitNumber: v.visit_number, date: v.date, rows: v.rows })),
  }).flatMap(({ visitId, readings }) => readings.map((r) => ({ visit_id: visitId, point_id: r.pointId, elevation: r.elevation })));

  it("lee todas las filas y no ve cambios donde no los hay", async () => {
    expect(books.length).toBeGreaterThan(1000);
    expect(stored.length).toBeGreaterThan(1000);
    const r = await recomputeSite(
      fakeClient({
        sites: { data: SITE, error: null },
        settlement_points: { data: points, error: null },
        site_benchmarks: { data: [{ code: C.benchmark.code, elevation: C.benchmark.elevation }], error: null },
        settlement_visits: { data: visitRows, error: null },
        settlement_book_readings: { data: books, error: null },
        settlement_readings: { data: stored, error: null },
      }),
      "s1",
      { dryRun: true },
    );
    expect(r).toEqual({ ok: true, visits: 70, changedVisits: 0, changedReadings: 0 });
  });

  it("la simulación cuenta también las lecturas que se borrarían", async () => {
    // La visita 0 pierde la fila de B10: su lectura guardada se purgaría.
    const sinB10 = books.filter((b) => !(b.visit_id === "v0" && b.point_code === "B10"));
    const r = await recomputeSite(
      fakeClient({
        sites: { data: SITE, error: null },
        settlement_points: { data: points, error: null },
        site_benchmarks: { data: [{ code: C.benchmark.code, elevation: C.benchmark.elevation }], error: null },
        settlement_visits: { data: visitRows, error: null },
        settlement_book_readings: { data: sinB10, error: null },
        settlement_readings: { data: stored, error: null },
      }),
      "s1",
      { dryRun: true },
    );
    expect(r).toMatchObject({ ok: true, changedVisits: 1, changedReadings: 1 });
  });
});
