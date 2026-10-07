import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { recomputeSite } from "./settlement-sync";

type Result = { data: unknown; error: { message: string; code?: string } | null };

/** Un cliente mínimo: cada tabla responde lo que se le da, con cualquier filtro. */
function fakeClient(tables: Record<string, Result>): SupabaseClient {
  return {
    from(table: string) {
      const result = tables[table] ?? { data: [], error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
      chain.maybeSingle = () => Promise.resolve(result);
      chain.then = (ok: (r: Result) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko);
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
