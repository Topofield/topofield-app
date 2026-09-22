// Inserta un informe del proyecto de ejemplo.
//
// Un informe no guarda copia de los datos: se reconstruye al abrirlo a partir
// de los procesos cerrados que incluye (todos inmutables por trigger). Aquí
// solo se persiste la cabecera y la lista `included_processes`, con la misma
// forma que arma `createReportAction`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { IncludedProcess } from "@/types/report";

type Client = SupabaseClient<Database>;

export async function insertarInforme(
  supabase: Client,
  projectId: string,
  userId: string,
  title: string,
  observations: string | null,
  included: IncludedProcess[],
): Promise<void> {
  const { error } = await supabase.from("reports").insert({
    project_id: projectId,
    title,
    included_processes: included,
    observations,
    generated_by: userId,
  });
  if (error) throw error;
}
