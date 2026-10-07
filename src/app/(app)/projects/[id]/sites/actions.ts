"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StructureType } from "@/types/site";
import { resyncSiteReadings } from "@/lib/supabase/settlement-sync";
import { logDbError } from "@/lib/errors/user-message";

export interface ActionResult {
  ok: boolean;
  error?: string;
  siteId?: string;
}

export interface SitePayload {
  projectId: string;
  name: string;
  description: string | null;
  structureType: StructureType;
  velocityCaution: number;
  velocityAlert: number;
  velocityAlarm: number;
  accumulatedCaution: number;
  accumulatedAlert: number;
  accumulatedAlarm: number;
}

/**
 * Valida los umbrales de un lugar. Deben ser positivos y estrictamente
 * crecientes: un umbral de alerta por debajo del de precaución haría que el
 * nivel intermedio no se alcanzara nunca, y el semáforo saltaría de normal a
 * alerta sin pasar por precaución.
 */
function validateThresholds(payload: SitePayload): string | null {
  const { velocityCaution: vc, velocityAlert: va, velocityAlarm: vm } = payload;
  const {
    accumulatedCaution: ac,
    accumulatedAlert: aa,
    accumulatedAlarm: am,
  } = payload;

  for (const [nombre, valor] of [
    ["precaución de velocidad", vc],
    ["alerta de velocidad", va],
    ["alarma de velocidad", vm],
    ["precaución de acumulado", ac],
    ["alerta de acumulado", aa],
    ["alarma de acumulado", am],
  ] as const) {
    if (!Number.isFinite(valor) || valor <= 0) {
      return `El umbral de ${nombre} debe ser un número positivo.`;
    }
  }

  if (!(vc < va && va < vm)) {
    return "Los umbrales de velocidad deben ser crecientes: precaución < alerta < alarma.";
  }
  if (!(ac < aa && aa < am)) {
    return "Los umbrales de asentamiento acumulado deben ser crecientes: precaución < alerta < alarma.";
  }
  return null;
}

/** Crea un lugar. Los umbrales llegan del preset del tipo de estructura. */
export async function createSiteAction(
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sites")
    .insert({
      project_id: payload.projectId,
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: logDbError(error, "No se pudo crear el lugar.") };

  revalidatePath(`/projects/${payload.projectId}`);
  return { ok: true, siteId: data.id };
}

/** Guarda la configuración de un lugar. */
export async function saveSiteAction(
  siteId: string,
  payload: SitePayload,
): Promise<ActionResult> {
  if (payload.name.trim() === "") {
    return { ok: false, error: "El lugar necesita un nombre." };
  }
  const thresholdError = validateThresholds(payload);
  if (thresholdError) return { ok: false, error: thresholdError };

  const supabase = await createClient();

  // Se lee también `project_id` real de la fila para el revalidatePath de
  // abajo: el `projectId` del payload lo controla el cliente y un cliente
  // malicioso podría enviar el id de un proyecto ajeno. Usar el valor leído
  // de la base evita revalidar (o filtrar la existencia de) una ruta que no
  // corresponde al lugar que en verdad se está guardando.
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  // Un lugar de agrupación (Fase 22) no es un control de asentamientos: no
  // se edita ni se cierra como tal, aunque se llame a la acción directamente.
  if (!site || site.kind !== "settlement") return { ok: false, error: "Lugar no encontrado." };

  const { error } = await supabase
    .from("sites")
    .update({
      name: payload.name.trim(),
      description: payload.description,
      structure_type: payload.structureType,
      velocity_caution: payload.velocityCaution,
      velocity_alert: payload.velocityAlert,
      velocity_alarm: payload.velocityAlarm,
      accumulated_caution: payload.accumulatedCaution,
      accumulated_alert: payload.accumulatedAlert,
      accumulated_alarm: payload.accumulatedAlarm,
    })
    .eq("id", siteId);

  if (error) return { ok: false, error: logDbError(error, "No se pudo guardar el lugar.") };

  // Los umbrales acaban de cambiar, y `settlement_readings.alert_status` es una
  // caché derivada de ellos: las lecturas ya guardadas conservan la
  // clasificación del criterio anterior. El hub las lee tal cual mientras el
  // panel del lugar recalcula en vivo, así que sin esto las dos vistas se
  // contradirían — y un informe que mezclara ambas fuentes se contradiría a sí
  // mismo dentro del mismo documento.
  const resync = await resyncSiteReadings(supabase, siteId);
  if (!resync.ok) return { ok: false, error: resync.error };

  revalidatePath(`/projects/${site.project_id}`);
  revalidatePath(`/projects/${site.project_id}/settlement/${siteId}`);
  return { ok: true };
}

/** Renombra un lugar (Fase 22), desde su fila en el hub. */
export async function renameSiteAction(siteId: string, name: string): Promise<ActionResult> {
  const limpio = name.trim();
  if (!limpio) return { ok: false, error: "El nombre no puede estar vacío." };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.kind !== "settlement") return { ok: false, error: "Lugar no encontrado." };

  const { error } = await supabase.from("sites").update({ name: limpio }).eq("id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo renombrar el lugar.") };

  revalidatePath(`/projects/${site.project_id}`);
  return { ok: true };
}

/**
 * Duplica un lugar (Fase 22): datos, umbrales, catálogo de puntos vigentes y
 * BM del lugar (Fase 37), sin visitas. Sirve para un monitoreo nuevo de la misma estructura. Los
 * puntos de baja no pasan; los que se dieron de alta a mitad del monitoreo
 * pasan como originales, porque en el lugar nuevo aún no hay visitas.
 */
export async function duplicateSiteAction(siteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .maybeSingle();
  if (!original || original.kind !== "settlement") {
    return { ok: false, error: "Lugar no encontrado." };
  }

  const { data: copia, error } = await supabase
    .from("sites")
    .insert({
      project_id: original.project_id,
      name: `${original.name} (copia)`,
      description: original.description,
      structure_type: original.structure_type,
      velocity_caution: original.velocity_caution,
      velocity_alert: original.velocity_alert,
      velocity_alarm: original.velocity_alarm,
      accumulated_caution: original.accumulated_caution,
      accumulated_alert: original.accumulated_alert,
      accumulated_alarm: original.accumulated_alarm,
      notes: original.notes,
      kind: "settlement",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: logDbError(error, "No se pudo duplicar el lugar.") };

  const { data: puntos, error: pointsError } = await supabase
    .from("settlement_points")
    .select("code, location_description, initial_elevation")
    .eq("site_id", siteId)
    .is("retired_on", null)
    .order("code");
  if (pointsError) {
    await supabase.from("sites").delete().eq("id", copia.id);
    return { ok: false, error: logDbError(pointsError, "No se pudo copiar el catálogo de puntos.") };
  }
  if (puntos.length > 0) {
    const { error: insertError } = await supabase
      .from("settlement_points")
      .insert(puntos.map((p) => ({ ...p, site_id: copia.id })));
    if (insertError) {
      // Sin el catálogo, el lugar copiado no sirve: se deshace.
      await supabase.from("sites").delete().eq("id", copia.id);
      return { ok: false, error: logDbError(insertError, "No se pudo copiar el catálogo de puntos.") };
    }
  }

  // Los BM del lugar van con él (Fase 37): sin ellos la visita nueva no
  // tendría desde dónde armarse.
  const { data: bms } = await supabase
    .from("site_benchmarks")
    .select("code, elevation, description, source")
    .eq("site_id", siteId);
  if (bms && bms.length > 0) {
    const { error: bmError } = await supabase
      .from("site_benchmarks")
      .insert(bms.map((b) => ({ ...b, site_id: copia.id })));
    if (bmError) {
      await supabase.from("sites").delete().eq("id", copia.id);
      return { ok: false, error: logDbError(bmError, "No se pudieron copiar los BM del lugar.") };
    }
  }

  revalidatePath(`/projects/${original.project_id}`);
  return { ok: true, siteId: copia.id };
}

/**
 * Elimina un lugar con sus puntos, sus BM y sus visitas (Fase 22). Desde la
 * Fase 37 nada se cierra: cualquier lugar se elimina.
 */
export async function deleteSiteAction(siteId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, project_id, kind")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.kind !== "settlement") return { ok: false, error: "Lugar no encontrado." };

  const { error } = await supabase.from("sites").delete().eq("id", siteId);
  if (error) return { ok: false, error: logDbError(error, "No se pudo eliminar el lugar.") };

  revalidatePath(`/projects/${site.project_id}`);
  return { ok: true };
}
