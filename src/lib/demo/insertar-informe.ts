// Inserta un informe del proyecto de ejemplo.
//
// Un informe no guarda copia de los datos: se reconstruye al abrirlo a partir
// de los procesos que incluye, con sus datos actuales. Aquí
// solo se persiste la cabecera, la portada congelada (`cover`, Fase 23) y la
// lista `included_processes`, con la misma forma que arma `createReportAction`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { IncludedProcess, ReportCoverData } from "@/types/report";

type Client = SupabaseClient<Database>;

export async function insertarInforme(
  supabase: Client,
  projectId: string,
  userId: string,
  cover: ReportCoverData,
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
    cover,
  });
  if (error) throw error;
}
