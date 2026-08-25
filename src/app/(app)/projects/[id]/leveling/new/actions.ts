"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LevelingType } from "@/types/leveling";

export interface CreateLevelingState {
  error?: string;
}

export interface CreateLevelingPayload {
  projectId: string;
  name: string;
  type: LevelingType;
  startBmCode: string;
  startBmElevation: number | null;
  endBmCode: string | null;
  endBmElevation: number | null;
  hasReturnRun: boolean;
}

/**
 * Crea un proceso de nivelación (status `draft`) y redirige a su editor. El
 * resto de la configuración y las lecturas de campo se completan en el editor.
 */
export async function createLevelingProcessAction(
  payload: CreateLevelingPayload,
): Promise<CreateLevelingState> {
  const name = payload.name.trim();
  const startBmCode = payload.startBmCode.trim();
  if (!name) return { error: "El nombre del proceso es obligatorio." };
  if (!startBmCode) {
    return { error: "El código del BM de partida es obligatorio." };
  }
  if (payload.startBmElevation == null) {
    return { error: "La cota del BM de partida es obligatoria." };
  }
  if (payload.type === "link") {
    const endBmCode = payload.endBmCode?.trim();
    if (!endBmCode || payload.endBmElevation == null) {
      return {
        error:
          "Una nivelación de enlace requiere el código y la cota del BM de llegada.",
      };
    }
  }

  const supabase = await createClient();

  // El lugar es obligatorio desde la Fase 5. Mientras el formulario no ofrezca
  // elegirlo (Task 10), se usa el primero del proyecto.
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("project_id", payload.projectId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!site) {
    return { error: "El proyecto no tiene ningún lugar definido." };
  }

  const { data, error } = await supabase
    .from("leveling_processes")
    .insert({
      project_id: payload.projectId,
      site_id: site.id,
      name,
      type: payload.type,
      start_bm_code: startBmCode,
      start_bm_elevation: payload.startBmElevation,
      end_bm_code: payload.endBmCode?.trim() || null,
      end_bm_elevation: payload.type === "link" ? payload.endBmElevation : null,
      has_return_run: payload.hasReturnRun,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el proceso. Intenta de nuevo." };
  }

  redirect(`/projects/${payload.projectId}/leveling/${data.id}`);
}
