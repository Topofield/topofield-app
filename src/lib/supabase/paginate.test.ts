import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { allRows } from "./paginate";

/** Una tabla tras PostgREST: cada petición da como mucho `cap` filas del rango. */
function table(rows: number[], cap: number) {
  const calls: [number, number][] = [];
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null });
  };
  return { page, calls };
}

describe("allRows (revisión final de la Fase 37)", () => {
  it("trae todas las filas aunque PostgREST corte en 1000", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const { page } = table(rows, 1000);
    expect((await allRows(page)).data).toEqual(rows);
  });

  it("no salta filas si el corte del servidor es menor que la página", async () => {
    const rows = Array.from({ length: 1234 }, (_, i) => i);
    const { page } = table(rows, 300);
    expect((await allRows(page)).data).toEqual(rows);
  });

  it("devuelve el error de cualquier página", async () => {
    const error = { message: "x" } as unknown as PostgrestError;
    const r = await allRows(() => Promise.resolve({ data: null, error }));
    expect(r.error?.message).toBe("x");
  });
});
