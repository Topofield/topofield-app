"use server";

// Los BM del lugar (Fase 37, decisiones 12 y 13): un catálogo propio de cada
// lugar, de copias que no se sincronizan con nada. Cambiar la cota de un BM
// recalcula las visitas que lo usan; uno que ya usa alguna no se elimina.

import { revalidatePath } from "next/cache";
import { samePointCode } from "@/lib/calculations/leveling";
import { createClient } from "@/lib/supabase/server";
import { recomputeSite } from "@/lib/supabase/settlement-sync";
import { logDbError } from "@/lib/errors/user-message";

export interface BenchmarkActionResult {
  ok: boolean;
  error?: string;
}

export interface BenchmarkPayload {
  /** Sin id, un BM nuevo. */
  id?: string;
  code: string;
  elevation: number;
  description: string | null;
}

export interface ImportedBenchmark {
  code: string;
  elevation: number;
  description: string | null;
  source: string | null;
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function loadSite(supabase: Client, siteId: string) {
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  return site && site.kind === "settlement" ? site : null;
}

/** Las filas de libreta del lugar que nombran un código: (fila, visita). */
async function rowsNaming(supabase: Client, siteId: string, code: string) {
  const { data } = await supabase
    .from("settlement_book_readings")
    .select("id, visit_id, point_code, settlement_visits!inner(site_id)")
    .eq("settlement_visits.site_id", siteId);
  return (data ?? []).filter((r) => samePointCode(r.point_code, code));
}

function revalidateSite(projectId: string, siteId: string) {
  revalidatePath(`/projects/${projectId}/settlement/${siteId}`);
  revalidatePath(`/projects/${projectId}`);
}

function checkPayload(p: Pick<BenchmarkPayload, "code" | "elevation">): string | null {
  if (p.code.trim() === "") return "El BM necesita un código.";
  if (!Number.isFinite(p.elevation)) return "La cota del BM debe ser un número.";
  return null;
}

/** Cuántas visitas usan un BM —arranque, cierre o de paso—, para el aviso. */
export async function benchmarkImpactAction(
  siteId: string,
  benchmarkId: string,
): Promise<{ visits: number }> {
  const supabase = await createClient();
  const { data: bm } = await supabase
    .from("site_benchmarks")
    .select("code")
    .eq("id", benchmarkId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (!bm) return { visits: 0 };
  const rows = await rowsNaming(supabase, siteId, bm.code);
  return { visits: new Set(rows.map((r) => r.visit_id)).size };
}

/**
 * Agrega o edita un BM del lugar. Si cambia la cota, recalcula las visitas
 * del lugar (decisión 13); si cambia el código, renombra antes las filas de
 * libreta que lo nombran, para que no queden sin BM.
 */
export async function saveBenchmarkAction(
  siteId: string,
  payload: BenchmarkPayload,
): Promise<BenchmarkActionResult> {
  const problem = checkPayload(payload);
  if (problem) return { ok: false, error: problem };
  const supabase = await createClient();
  const site = await loadSite(supabase, siteId);
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  const code = payload.code.trim();

  if (!payload.id) {
    const { error } = await supabase.from("site_benchmarks").insert({
      site_id: siteId,
      code,
      elevation: payload.elevation,
      description: payload.description,
      source: "Tecleado",
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: `Ya hay un BM ${code} en este lugar.` };
      return { ok: false, error: logDbError(error, "No se pudo agregar el BM.") };
    }
    revalidateSite(site.project_id, siteId);
    return { ok: true };
  }

  const { data: current } = await supabase
    .from("site_benchmarks")
    .select("*")
    .eq("id", payload.id)
    .eq("site_id", siteId)
    .maybeSingle();
  if (!current) return { ok: false, error: "BM no encontrado." };

  const { error } = await supabase
    .from("site_benchmarks")
    .update({ code, elevation: payload.elevation, description: payload.description })
    .eq("id", payload.id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Ya hay un BM ${code} en este lugar.` };
    return { ok: false, error: logDbError(error, "No se pudo guardar el BM.") };
  }

  const renamed = !samePointCode(current.code, code);
  if (renamed) {
    const rows = await rowsNaming(supabase, siteId, current.code);
    if (rows.length > 0) {
      const { error: renameError } = await supabase
        .from("settlement_book_readings")
        .update({ point_code: code })
        .in("id", rows.map((r) => r.id));
      if (renameError) return { ok: false, error: logDbError(renameError, "No se pudo renombrar el BM en las libretas.") };
    }
  }
  if (renamed || Number(current.elevation) !== payload.elevation) {
    const recomputed = await recomputeSite(supabase, siteId);
    if (!recomputed.ok) return { ok: false, error: recomputed.error };
  }

  revalidateSite(site.project_id, siteId);
  return { ok: true };
}

/** Elimina un BM del lugar, si ninguna visita lo usa. */
export async function deleteBenchmarkAction(
  siteId: string,
  benchmarkId: string,
): Promise<BenchmarkActionResult> {
  const supabase = await createClient();
  const site = await loadSite(supabase, siteId);
  if (!site) return { ok: false, error: "Lugar no encontrado." };
  const { data: bm } = await supabase
    .from("site_benchmarks")
    .select("code")
    .eq("id", benchmarkId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (!bm) return { ok: false, error: "BM no encontrado." };

  const uses = new Set((await rowsNaming(supabase, siteId, bm.code)).map((r) => r.visit_id)).size;
  if (uses > 0) {
    return {
      ok: false,
      error: `${bm.code} se usa en ${uses} ${uses === 1 ? "visita" : "visitas"}: no se puede eliminar.`,
    };
  }
  const { error } = await supabase.from("site_benchmarks").delete().eq("id", benchmarkId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el BM.") };
  revalidateSite(site.project_id, siteId);
  return { ok: true };
}

/**
 * Importa BM al lugar, de una nivelación del proyecto o de un CSV (decisión
 * 12): se copian con su origen. Un código que ya existe se rechaza con su
 * nombre, para no sobrescribir un BM sin querer.
 */
export async function importBenchmarksAction(
  siteId: string,
  items: ImportedBenchmark[],
): Promise<BenchmarkActionResult> {
  if (items.length === 0) return { ok: false, error: "No hay BM para importar." };
  for (const item of items) {
    const problem = checkPayload(item);
    if (problem) return { ok: false, error: `${item.code || "Un BM"}: ${problem}` };
  }
  const supabase = await createClient();
  const site = await loadSite(supabase, siteId);
  if (!site) return { ok: false, error: "Lugar no encontrado." };

  const { data: existing } = await supabase.from("site_benchmarks").select("code").eq("site_id", siteId);
  const repeated = items.find((i) => (existing ?? []).some((e) => samePointCode(e.code, i.code)));
  if (repeated) {
    return { ok: false, error: `Ya hay un BM ${repeated.code.trim()} en este lugar: quítalo de la importación o edítalo.` };
  }

  const { error } = await supabase.from("site_benchmarks").insert(
    items.map((i) => ({
      site_id: siteId,
      code: i.code.trim(),
      elevation: i.elevation,
      description: i.description,
      source: i.source,
    })),
  );
  if (error) return { ok: false, error: logDbError(error, "No se pudieron importar los BM.") };
  revalidateSite(site.project_id, siteId);
  return { ok: true };
}
