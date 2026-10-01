// Inserta los equipos del catálogo del proyecto de ejemplo (Fase 25).

import type { SupabaseClient } from "@supabase/supabase-js";
import { sameInstrument } from "@/lib/equipment";
import type { Database } from "@/types/database";
import type { EQUIPOS_DEMO } from "./fixtures";

type Client = SupabaseClient<Database>;

/**
 * Da de alta en el catálogo del usuario los equipos que faltan. Solo los que
 * faltan: borrar los proyectos —como al regenerar la demo de producción— no
 * vacía el catálogo, y el índice único rechazaría el mismo aparato dos veces.
 */
export async function insertarEquipos(
  supabase: Client,
  userId: string,
  equipos: typeof EQUIPOS_DEMO,
): Promise<void> {
  const { data: existentes, error: readError } = await supabase
    .from("equipment")
    .select("kind, brand, model, serial");
  if (readError) throw readError;

  const nuevos = equipos.filter(
    (e) => !(existentes ?? []).some((x) => x.kind === e.kind && sameInstrument(x, e)),
  );
  if (nuevos.length === 0) return;

  const { error } = await supabase
    .from("equipment")
    .insert(nuevos.map((e) => ({ ...e, user_id: userId })));
  if (error) throw error;
}
