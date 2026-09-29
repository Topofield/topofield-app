// El lugar de agrupación de un proyecto (Fase 22).
//
// `site_id` es NOT NULL en poligonales y nivelaciones desde la Fase 5, pero un
// levantamiento no es un control de asentamientos: cuelga de un lugar de tipo
// `grouping`, que la interfaz no muestra. Antes se tomaba «el primer lugar del
// proyecto», que podía ser un control de asentamientos real.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { logDbError } from "@/lib/errors/user-message";

type Client = SupabaseClient<Database>;

/**
 * Id del lugar de agrupación más antiguo del proyecto. Si no hay ninguno
 * —proyectos anteriores al «Área principal» automático, o uno cuyo lugar se
 * reclasificó—, lo crea. Devuelve el mensaje para el usuario si falla.
 */
export async function groupingSiteId(
  supabase: Client,
  projectId: string,
): Promise<{ id: string } | { error: string }> {
  const { data: site, error } = await supabase
    .from("sites")
    .select("id")
    .eq("project_id", projectId)
    .eq("kind", "grouping")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return { error: logDbError(error, "No se pudo preparar el proyecto para el proceso.") };
  if (site) return { id: site.id };

  const { data: created, error: createError } = await supabase
    .from("sites")
    .insert({
      project_id: projectId,
      name: "Área principal",
      structure_type: "otro",
      kind: "grouping",
    })
    .select("id")
    .single();
  if (createError) {
    return { error: logDbError(createError, "No se pudo preparar el proyecto para el proceso.") };
  }
  return { id: created.id };
}
