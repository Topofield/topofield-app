"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
  pointId?: string;
}

export interface PointPayload {
  siteId: string;
  code: string;
  locationDescription: string;
  northing: number | null;
  easting: number | null;
  initialElevation: number | null;
}

/**
 * Valida los campos que controla el usuario. Las coordenadas N/E son
 * opcionales, pero si viene una debe venir la otra: con solo N o solo E no se
 * puede calcular ninguna distancia, y el par quedaría silenciosamente fuera
 * de la tabla de diferenciales.
 */
function validatePointPayload(payload: PointPayload): string | null {
  if (payload.code.trim() === "") {
    return "El punto necesita un código.";
  }
  if (payload.locationDescription.trim() === "") {
    return "El punto necesita una descripción de ubicación.";
  }
  const tieneN = payload.northing !== null;
  const tieneE = payload.easting !== null;
  if (tieneN !== tieneE) {
    return "Indica las dos coordenadas (N y E) o ninguna.";
  }
  return null;
}

/** Carga el lugar y verifica que exista y no esté cerrado. */
async function loadOpenSite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
) {
  const { data: site } = await supabase
    .from("sites")
    .select("id, status, project_id")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return { ok: false as const, error: "Lugar no encontrado." };
  if (site.status === "closed") {
    return {
      ok: false as const,
      error: "El lugar está cerrado; no admite cambios en el catálogo.",
    };
  }
  return { ok: true as const, site };
}

/** Crea un punto del catálogo de un lugar. */
export async function createPointAction(
  payload: PointPayload,
): Promise<ActionResult> {
  const validationError = validatePointPayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const { data, error } = await supabase
    .from("settlement_points")
    .insert({
      site_id: payload.siteId,
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      northing: payload.northing,
      easting: payload.easting,
      initial_elevation: payload.initialElevation,
    })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation del UNIQUE (site_id, code): dos puntos del
    // mismo lugar no pueden compartir código, porque el código es la clave
    // que el usuario usa para identificar el punto en campo.
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ya existe un punto con ese código en este lugar.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${payload.siteId}`);
  return { ok: true, pointId: data.id };
}

/** Guarda los datos de un punto existente del catálogo. */
export async function savePointAction(
  pointId: string,
  payload: PointPayload,
): Promise<ActionResult> {
  const validationError = validatePointPayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, payload.siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const { error } = await supabase
    .from("settlement_points")
    .update({
      code: payload.code.trim(),
      location_description: payload.locationDescription.trim(),
      northing: payload.northing,
      easting: payload.easting,
      initial_elevation: payload.initialElevation,
    })
    .eq("id", pointId)
    .eq("site_id", payload.siteId);

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ya existe un punto con ese código en este lugar.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${payload.siteId}`);
  return { ok: true };
}

/**
 * Elimina un punto del catálogo. Rechaza el borrado si el punto tiene
 * lecturas en visitas cerradas: esas lecturas son parte del registro
 * inmutable del monitoreo y borrar el punto las dejaría huérfanas de
 * catálogo.
 */
export async function deletePointAction(
  siteId: string,
  pointId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const siteCheck = await loadOpenSite(supabase, siteId);
  if (!siteCheck.ok) return { ok: false, error: siteCheck.error };

  const { count } = await supabase
    .from("settlement_readings")
    .select("id, settlement_visits!inner(status)", {
      count: "exact",
      head: true,
    })
    .eq("point_id", pointId)
    .eq("settlement_visits.status", "closed");
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "El punto tiene lecturas en visitas cerradas y no puede eliminarse.",
    };
  }

  const { error } = await supabase
    .from("settlement_points")
    .delete()
    .eq("id", pointId)
    .eq("site_id", siteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${siteCheck.site.project_id}/sites/${siteId}`);
  return { ok: true };
}
