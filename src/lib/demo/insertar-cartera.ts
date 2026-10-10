// La cartera real de asentamientos como lugar (Fase 37, decisión 23): la usan
// la demo de cada usuario nuevo, el seed y el script que la agrega a las demos
// ya creadas (`scripts/agregar-cartera-demo.mjs`).

import type { SupabaseClient } from "@supabase/supabase-js";
import { thresholdsFor } from "@/lib/calculations/tolerances";
import type { Database } from "@/types/database";
import type { PointInput } from "@/types/settlement";
import { CARTERA_ASENTAMIENTOS as C, carteraVisitas } from "./cartera-asentamientos";
import { insertarVisitas } from "./insertar-visitas";

type Client = SupabaseClient<Database>;

/**
 * Crea en el proyecto el lugar «Control de asentamiento estructural»: sus 16
 * puntos sin C0, el BM de la piscina en los BM del lugar y las 7 visitas, cada
 * una con su armada. Devuelve el id del lugar, o null si el proyecto ya lo
 * tenía (no hace nada).
 */
export async function insertarCartera(supabase: Client, projectId: string): Promise<string | null> {
  const { data: existente, error: errExiste } = await supabase
    .from("sites")
    .select("id")
    .eq("project_id", projectId)
    .eq("name", C.name)
    .limit(1);
  if (errExiste) throw errExiste;
  if ((existente ?? []).length > 0) return null;

  // Los umbrales no se envían: los DEFAULT de `sites` son los de edificio.
  const { data: lugar, error: errLugar } = await supabase
    .from("sites")
    .insert({ project_id: projectId, name: C.name, description: C.description, structure_type: "edificio" })
    .select("id")
    .single();
  if (errLugar) throw errLugar;

  const { data: puntoRows, error: errPuntos } = await supabase
    .from("settlement_points")
    // La hoja no da la ubicación de los puntos.
    .insert(C.points.map((code) => ({ site_id: lugar.id, code, location_description: "", initial_elevation: null })))
    .select("id, code");
  if (errPuntos) throw errPuntos;
  const idPorCodigo = new Map(puntoRows.map((p) => [p.code, p.id]));
  const points: PointInput[] = C.points.map((code) => ({
    id: idPorCodigo.get(code)!,
    code,
    initialElevation: null,
    activeFrom: null,
    retiredOn: null,
  }));

  const { error: errBm } = await supabase.from("site_benchmarks").insert({
    site_id: lugar.id,
    code: C.benchmark.code,
    elevation: C.benchmark.elevation,
    description: "BM de la piscina",
    source: "Cartera de campo",
  });
  if (errBm) throw errBm;

  await insertarVisitas(
    supabase,
    lugar.id,
    points,
    [C.benchmark],
    thresholdsFor("edificio"),
    carteraVisitas().map((v) => ({ ...v, operator: null })),
  );
  return lugar.id;
}
