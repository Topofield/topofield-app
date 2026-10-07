"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { groupingSiteId } from "@/lib/supabase/grouping-site";
import type { LibretaRow } from "@/lib/import/leveling";
import type { LevelingType } from "@/types/leveling";
import { saveLevelingProcessAction, type ReadingDraft } from "./[pid]/actions";

export interface CreateLevelingPayload {
  projectId: string;
  name: string;
  type: LevelingType;
  hasReturnRun: boolean;
  startBmCode: string;
  startBmElevation: number | null;
  endBmCode: string | null;
  endBmElevation: number | null;
  location: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  /** Lecturas importadas desde archivo (Fase 16); null al crear vacía. */
  readings: { forward: LibretaRow[]; return: LibretaRow[] } | null;
}

function toDraft(r: LibretaRow): ReadingDraft {
  return { ...r, backUpperM: null, backLowerM: null, foreUpperM: null, foreLowerM: null };
}

/**
 * Crea una nivelación desde el popup del alta (Fase 36) y lleva a su libreta.
 * Sin orden de precisión: se detecta al compensar. La libreta arranca con el
 * BM de partida, o con lo importado del `.L` o del CSV.
 */
export async function createLevelingProcessAction(
  payload: CreateLevelingPayload,
): Promise<{ error?: string }> {
  const name = payload.name.trim();
  const startBmCode = payload.startBmCode.trim();
  const endBmCode = payload.endBmCode?.trim() || null;
  if (!name) return { error: "El título es obligatorio." };
  if (!startBmCode) return { error: "El código del BM de partida es obligatorio." };
  if (payload.startBmElevation == null) return { error: "La cota del BM de partida es obligatoria." };
  if (payload.type === "link" && (!endBmCode || payload.endBmElevation == null)) {
    return { error: "Una nivelación de enlace pide el código y la cota del BM de llegada." };
  }

  const supabase = await createClient();
  const site = await groupingSiteId(supabase, payload.projectId);
  if ("error" in site) return { error: site.error };

  const { data, error } = await supabase
    .from("leveling_processes")
    .insert({
      project_id: payload.projectId,
      site_id: site.id,
      name,
      type: payload.type,
      start_bm_code: startBmCode,
      start_bm_elevation: payload.startBmElevation,
      end_bm_code: payload.type === "link" ? endBmCode : null,
      end_bm_elevation: payload.type === "link" ? payload.endBmElevation : null,
      has_return_run: payload.hasReturnRun,
      precision_order: null,
      location: payload.location,
      responsible_name: payload.responsibleName,
      responsible_role: payload.responsibleRole,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo crear la nivelación. Intenta de nuevo." };

  const forward = payload.readings
    ? payload.readings.forward.map(toDraft)
    : [toDraft({
        pointCode: startBmCode,
        pointType: "bm",
        backsight: null,
        foresight: null,
        backDistanceM: null,
        foreDistanceM: null,
      })];
  const saved = await saveLevelingProcessAction({
    processId: data.id,
    name,
    type: payload.type,
    startBmCode,
    startBmElevation: payload.startBmElevation,
    endBmCode: payload.type === "link" ? endBmCode : null,
    endBmElevation: payload.type === "link" ? payload.endBmElevation : null,
    hasReturnRun: payload.hasReturnRun,
    notes: null,
    location: payload.location,
    responsibleName: payload.responsibleName,
    responsibleRole: payload.responsibleRole,
    equipmentBrand: payload.equipmentBrand,
    equipmentModel: payload.equipmentModel,
    equipmentSerial: payload.equipmentSerial,
    forward,
    return: payload.readings ? payload.readings.return.map(toDraft) : [],
  });
  if (!saved.ok) {
    await supabase.from("leveling_processes").delete().eq("id", data.id);
    return { error: `No se pudo guardar la libreta: ${saved.error ?? "error desconocido"}` };
  }

  redirect(`/projects/${payload.projectId}/leveling/${data.id}?tab=libreta`);
}
