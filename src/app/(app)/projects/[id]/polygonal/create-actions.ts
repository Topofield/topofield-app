"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logDbError } from "@/lib/errors/user-message";
import { groupingSiteId } from "@/lib/supabase/grouping-site";
import { POLYGONAL_TYPES, type PolygonalType } from "@/types/polygonal";

export interface CreatePolygonalPayload {
  projectId: string;
  name: string;
  location: string | null;
  responsibleName: string | null;
  responsibleRole: string | null;
  type: PolygonalType;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  equipmentSerial: string | null;
}

/**
 * Crea una poligonal desde el popup del alta (Fase 35) y lleva a su paso de
 * datos. El amarre y las mediciones se capturan allí: el proceso nace en
 * borrador, sin punto de partida —el código vacío dice que falta el amarre— y
 * sin orden de precisión, que se detecta al calcular.
 */
export async function createPolygonalProcessAction(
  payload: CreatePolygonalPayload,
): Promise<{ error?: string }> {
  const name = payload.name.trim();
  if (!name) return { error: "El título es obligatorio." };
  if (!POLYGONAL_TYPES.includes(payload.type)) return { error: "Tipo de poligonal no válido." };

  const supabase = await createClient();
  // El proceso cuelga del lugar de agrupación del proyecto (Fase 22).
  const site = await groupingSiteId(supabase, payload.projectId);
  if ("error" in site) return { error: site.error };

  const clean = (v: string | null) => (v && v.trim() !== "" ? v.trim() : null);
  const { data, error } = await supabase
    .from("polygonal_processes")
    .insert({
      project_id: payload.projectId,
      site_id: site.id,
      name,
      location: clean(payload.location),
      responsible_name: clean(payload.responsibleName),
      responsible_role: clean(payload.responsibleRole),
      type: payload.type,
      angle_type: payload.type === "open_controlled" ? "deflection" : "interior",
      start_point_code: "",
      start_north: 0,
      start_east: 0,
      precision_order: null,
      angle_input_format: "dms",
      equipment_brand: clean(payload.equipmentBrand),
      equipment_model: clean(payload.equipmentModel),
      equipment_serial: clean(payload.equipmentSerial),
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { error: logDbError(error ?? { message: "sin fila" }, "No se pudo crear la poligonal. Intenta de nuevo.") };
  }

  redirect(`/projects/${payload.projectId}/polygonal/${data.id}?tab=datos`);
}
