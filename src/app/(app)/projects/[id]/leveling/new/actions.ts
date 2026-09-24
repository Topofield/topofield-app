"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LevelingType } from "@/types/leveling";
import type { LibretaRow } from "@/lib/import/leveling";
import { saveLevelingProcessAction, type ReadingDraft } from "../[pid]/actions";
import type { LevelType, PrecisionOrder } from "@/types/project";

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
  /** Orden de precisión y equipo (nivel, ISO 17123-2). */
  precisionOrder: PrecisionOrder;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
  equipmentCalibrationDate: string | null;
  levelType: LevelType | null;
  kmPrecisionMm: number | null;
  /** Lecturas importadas desde archivo (Fase 16); null al crear vacío. */
  readings: { forward: LibretaRow[]; return: LibretaRow[] } | null;
}

function toDraft(r: LibretaRow): ReadingDraft {
  return {
    ...r,
    backUpperM: null,
    backLowerM: null,
    foreUpperM: null,
    foreLowerM: null,
  };
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
      precision_order: payload.precisionOrder,
      equipment_brand: payload.equipmentBrand,
      equipment_model: payload.equipmentModel,
      equipment_serial: payload.equipmentSerial,
      equipment_calibration_date: payload.equipmentCalibrationDate,
      level_type: payload.levelType,
      km_precision_mm: payload.kmPrecisionMm,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "No se pudo crear el proceso. Intenta de nuevo." };
  }

  // Con lecturas importadas se guardan por el camino de siempre, que
  // recalcula en el servidor. Si no se pueden guardar, el proceso recién
  // creado sobra: se borra, para no dejar un borrador vacío que el usuario
  // no pidió.
  if (payload.readings) {
    const saved = await saveLevelingProcessAction({
      processId: data.id,
      name,
      type: payload.type,
      startBmCode,
      startBmElevation: payload.startBmElevation,
      endBmCode: payload.endBmCode?.trim() || null,
      endBmElevation: payload.type === "link" ? payload.endBmElevation : null,
      hasReturnRun: payload.hasReturnRun,
      notes: null,
      forward: payload.readings.forward.map(toDraft),
      return: payload.readings.return.map(toDraft),
      precisionOrder: payload.precisionOrder,
      equipmentBrand: payload.equipmentBrand,
      equipmentModel: payload.equipmentModel,
      equipmentSerial: payload.equipmentSerial,
      equipmentCalibrationDate: payload.equipmentCalibrationDate,
      levelType: payload.levelType,
      kmPrecisionMm: payload.kmPrecisionMm,
    });
    if (!saved.ok) {
      await supabase.from("leveling_processes").delete().eq("id", data.id);
      return {
        error: `No se pudieron guardar las lecturas importadas: ${saved.error ?? "error desconocido"}`,
      };
    }
  }

  redirect(`/projects/${payload.projectId}/leveling/${data.id}`);
}
