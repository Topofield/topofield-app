"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getClosedWorkForReports,
  getProjectById,
} from "@/lib/supabase/queries";
import { isEligible } from "@/lib/reports/eligibility";
import type { IncludedProcess } from "@/types/report";

export interface ReportActionResult {
  ok: boolean;
  error?: string;
  reportId?: string;
}

export interface ReportPayload {
  projectId: string;
  title: string;
  observations: string | null;
  /** Ids de los trabajos elegidos, en el orden que tendrán las secciones. */
  selected: { kind: string; id: string }[];
}

/**
 * Crea un informe (§ 4.7).
 *
 * La elegibilidad se **revalida en el servidor** con la misma función pura que
 * usa la pantalla: el cliente envía ids, y un cliente manipulado podría
 * mandar el de un proceso abierto o rechazado. Sin esta comprobación, un
 * informe podría acabar apuntando a datos que aún cambian, y dejaría de ser
 * reproducible — que es lo que permite no guardar una copia de los datos.
 *
 * `name` se congela aquí, no al leer: es el nombre con el que se emitió.
 */
export async function createReportAction(
  payload: ReportPayload,
): Promise<ReportActionResult> {
  const title = payload.title.trim();
  if (title === "") {
    return { ok: false, error: "El informe necesita un título." };
  }
  if (payload.selected.length === 0) {
    return { ok: false, error: "Elige al menos un proceso cerrado." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida." };

  const project = await getProjectById(supabase, payload.projectId);
  if (!project) return { ok: false, error: "Proyecto no encontrado." };

  // Se parte de lo que la base dice que está cerrado, no de lo que llegó.
  const disponibles = await getClosedWorkForReports(supabase, project.id);
  const porClave = new Map(
    disponibles.filter(isEligible).map((c) => [`${c.kind}:${c.id}`, c]),
  );

  const included: IncludedProcess[] = [];
  for (const [i, sel] of payload.selected.entries()) {
    const candidato = porClave.get(`${sel.kind}:${sel.id}`);
    if (!candidato) {
      return {
        ok: false,
        error:
          "Alguno de los procesos elegidos ya no está cerrado o no pertenece al proyecto.",
      };
    }
    included.push({
      type: candidato.kind,
      id: candidato.id,
      name: candidato.name,
      order: i,
    });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      project_id: project.id,
      title,
      included_processes: included,
      observations: payload.observations,
      generated_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${project.id}`);
  return { ok: true, reportId: data.id };
}

/** Elimina un informe. No hay edición: se borra y se rehace. */
export async function deleteReportAction(
  projectId: string,
  reportId: string,
): Promise<ReportActionResult> {
  const supabase = await createClient();

  const project = await getProjectById(supabase, projectId);
  if (!project) return { ok: false, error: "Proyecto no encontrado." };

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", reportId)
    .eq("project_id", project.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${project.id}`);
  return { ok: true };
}
